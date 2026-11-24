// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {DeleqLimitMath as M} from "./DeleqLimitMath.sol";

/// @notice Minimal ERC-20 surface the guard reads.
interface IDeleqERC20 {
    function balanceOf(address) external view returns (uint256);
    function allowance(address, address) external view returns (uint256);
}

/// @notice Uniswap v3 SwapRouter02 exactInputSingle (no deadline field in this router build).
interface IDeleqSwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @title DeleqMandateGuard
/// @notice Permission and spending limits for trading agents on Robinhood Chain.
///
///         An owner creates a mandate for one agent address: which ERC-20 tokens the agent may spend (each with a
///         per-transaction cap and a calendar-UTC daily cap), which recipients it may pay, which swap routers it may
///         use, a validity window and an optional number of actions per day. The agent then asks the guard to move
///         the owner's tokens. Every limit is checked here, on chain, before anything moves.
///
///         Non-custodial: the guard never holds a balance at rest. A transfer is `transferFrom(owner -> recipient)`
///         under the owner's own ERC-20 allowance to this contract. A swap pulls `amountIn` from the owner, approves
///         exactly that amount to an allowlisted router, forces the swap output recipient to the owner, resets the
///         approval to zero and checks that nothing is left behind, all inside one transaction.
///
///         No admin, no fee, no upgrade, no pause switch over other people's mandates. Only a mandate's owner can
///         change it; pause and revoke take effect for the very next call, in the same block. The agent can never
///         raise its own limits; it can only pause itself.
///
///         Not supported in v1: native ETH (use WETH), fee-on-transfer tokens (refused: the received amount must
///         equal the amount sent), rebasing tokens whose balance moves inside a transfer.
contract DeleqMandateGuard {
    // ---- types --------------------------------------------------------------------------------------------

    struct Mandate {
        address owner;
        address agent;
        uint64 validFrom;
        uint64 expiry;
        uint32 maxActionsPerDay; // 0 = no count limit
        uint32 version; // bumps on every owner change
        bool paused;
        bool revoked;
        bytes32 label;
        uint64 createdAt;
        uint64 actions; // executed actions, all time
    }

    struct TokenRule {
        uint128 perTxCap;
        uint128 dailyCap;
        bool listed;
    }

    struct TokenInit {
        address token;
        uint128 perTxCap;
        uint128 dailyCap;
    }

    struct MandateInit {
        address agent;
        uint64 validFrom; // 0 = now
        uint64 expiry;
        uint32 maxActionsPerDay;
        bytes32 label;
        TokenInit[] tokens;
        address[] recipients;
        address[] routers;
    }

    /// @notice One swap request from the agent.
    struct SwapOrder {
        address router;
        address tokenIn;
        address tokenOut;
        uint24 fee;
        uint256 amountIn;
        uint256 minOut;
        bytes32 ref;
    }

    struct DaySpend {
        uint64 day;
        uint192 spent;
    }

    struct DayCount {
        uint64 day;
        uint32 count;
    }

    // ---- limits ---------------------------------------------------------------------------------------------

    uint256 public constant MAX_TOKENS = 16;
    uint256 public constant MAX_RECIPIENTS = 32;
    uint256 public constant MAX_ROUTERS = 4;
    uint256 public constant MAX_DURATION = 730 days;
    uint256 public constant MAX_MANDATES_PER_OWNER = 64;

    uint8 private constant SET_TOKENS = 0;
    uint8 private constant SET_RECIPIENTS = 1;
    uint8 private constant SET_ROUTERS = 2;

    // ---- storage ------------------------------------------------------------------------------------------

    uint256 public mandateCount;
    mapping(uint256 => Mandate) private _mandates;
    mapping(uint256 => mapping(address => TokenRule)) private _rules;
    mapping(uint256 => mapping(address => bool)) private _recipientOk;
    mapping(uint256 => mapping(address => bool)) private _routerOk;
    mapping(uint256 => mapping(address => DaySpend)) private _spent;
    mapping(uint256 => DayCount) private _count;

    // enumerable lists for the dashboard (id => set kind => members / 1-based index)
    mapping(uint256 => mapping(uint8 => address[])) private _members;
    mapping(uint256 => mapping(uint8 => mapping(address => uint256))) private _index;

    mapping(address => uint256[]) private _byOwner;
    mapping(address => uint256[]) private _byAgent;

    uint256 private _lock = 1;

    // ---- events -------------------------------------------------------------------------------------------

    event MandateCreated(
        uint256 indexed id,
        address indexed owner,
        address indexed agent,
        uint64 validFrom,
        uint64 expiry,
        uint32 maxActionsPerDay,
        bytes32 label
    );
    event TokenRuleSet(uint256 indexed id, address indexed token, uint128 perTxCap, uint128 dailyCap, bool listed, uint32 version);
    event RecipientSet(uint256 indexed id, address indexed recipient, bool allowed, uint32 version);
    event RouterSet(uint256 indexed id, address indexed router, bool allowed, uint32 version);
    event WindowSet(uint256 indexed id, uint64 validFrom, uint64 expiry, uint32 version);
    event MaxActionsSet(uint256 indexed id, uint32 maxActionsPerDay, uint32 version);
    event Paused(uint256 indexed id, address indexed by);
    event Unpaused(uint256 indexed id);
    event Revoked(uint256 indexed id);
    event TransferExecuted(
        uint256 indexed id,
        uint64 indexed actionNo,
        address indexed agent,
        address token,
        address to,
        uint256 amount,
        uint64 day,
        uint256 spentToday,
        bytes32 ref
    );
    event SwapExecuted(
        uint256 indexed id,
        uint64 indexed actionNo,
        address indexed agent,
        address router,
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOut,
        uint64 day,
        uint256 spentToday,
        bytes32 ref
    );

    // ---- errors -------------------------------------------------------------------------------------------

    error NotOwner();
    error NotAgent();
    error Reentrancy();
    error BadAgent();
    error BadWindow();
    error BadCaps();
    error BadAddress();
    error TooMany();
    error AlreadyRevoked();
    error Rejected(uint256 reasons);
    error TokenCallFailed(address token);
    error FeeOnTransferNotSupported(uint256 sent, uint256 received);
    error SwapShortfall(uint256 received, uint256 minOut);
    error LeftoverBalance(address token, uint256 leftover);

    // ---- modifiers ----------------------------------------------------------------------------------------

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    modifier onlyOwner(uint256 id) {
        if (_mandates[id].owner != msg.sender || msg.sender == address(0)) revert NotOwner();
        _;
    }

    // =========================================================================================================
    // Owner: create and change
    // =========================================================================================================

    /// @notice Creates a mandate owned by the caller for `init.agent`.
    function createMandate(MandateInit calldata init) external returns (uint256 id) {
        if (init.agent == address(0) || init.agent == msg.sender || init.agent == address(this)) revert BadAgent();
        uint64 from = init.validFrom == 0 ? uint64(block.timestamp) : init.validFrom;
        _checkWindow(from, init.expiry);
        if (_byOwner[msg.sender].length >= MAX_MANDATES_PER_OWNER) revert TooMany();

        id = ++mandateCount;
        Mandate storage m = _mandates[id];
        m.owner = msg.sender;
        m.agent = init.agent;
        m.validFrom = from;
        m.expiry = init.expiry;
        m.maxActionsPerDay = init.maxActionsPerDay;
        m.label = init.label;
        m.createdAt = uint64(block.timestamp);
        _byOwner[msg.sender].push(id);
        _byAgent[init.agent].push(id);
        emit MandateCreated(id, msg.sender, init.agent, from, init.expiry, init.maxActionsPerDay, init.label);

        for (uint256 i; i < init.tokens.length; ++i) {
            TokenInit calldata t = init.tokens[i];
            _setTokenRule(id, t.token, t.perTxCap, t.dailyCap, true);
        }
        for (uint256 i; i < init.recipients.length; ++i) {
            _setRecipient(id, init.recipients[i], true);
        }
        for (uint256 i; i < init.routers.length; ++i) {
            _setRouter(id, init.routers[i], true);
        }
    }

    /// @notice Adds, changes or removes (listed = false) a token rule.
    function setTokenRule(uint256 id, address token, uint128 perTxCap, uint128 dailyCap, bool listed)
        external
        onlyOwner(id)
    {
        _notRevoked(id);
        _setTokenRule(id, token, perTxCap, dailyCap, listed);
    }

    function setRecipient(uint256 id, address recipient, bool allowed) external onlyOwner(id) {
        _notRevoked(id);
        _setRecipient(id, recipient, allowed);
    }

    function setRouter(uint256 id, address router, bool allowed) external onlyOwner(id) {
        _notRevoked(id);
        _setRouter(id, router, allowed);
    }

    function setWindow(uint256 id, uint64 validFrom, uint64 expiry) external onlyOwner(id) {
        _notRevoked(id);
        _checkWindow(validFrom, expiry);
        Mandate storage m = _mandates[id];
        m.validFrom = validFrom;
        m.expiry = expiry;
        emit WindowSet(id, validFrom, expiry, ++m.version);
    }

    function setMaxActionsPerDay(uint256 id, uint32 maxActionsPerDay) external onlyOwner(id) {
        _notRevoked(id);
        Mandate storage m = _mandates[id];
        m.maxActionsPerDay = maxActionsPerDay;
        emit MaxActionsSet(id, maxActionsPerDay, ++m.version);
    }

    /// @notice Stops the agent from the next call on. The owner can unpause; a revoke is final.
    function pause(uint256 id) external onlyOwner(id) {
        _pause(id);
    }

    function unpause(uint256 id) external onlyOwner(id) {
        _notRevoked(id);
        Mandate storage m = _mandates[id];
        if (m.paused) {
            m.paused = false;
            ++m.version;
            emit Unpaused(id);
        }
    }

    /// @notice Ends the mandate for good. Nothing can execute under it again and it cannot be changed.
    function revoke(uint256 id) external onlyOwner(id) {
        Mandate storage m = _mandates[id];
        if (m.revoked) revert AlreadyRevoked();
        m.revoked = true;
        ++m.version;
        emit Revoked(id);
    }

    /// @notice The agent's own kill switch: it can pause itself, never unpause.
    function agentPause(uint256 id) external {
        if (_mandates[id].agent != msg.sender || msg.sender == address(0)) revert NotAgent();
        _pause(id);
    }

    // =========================================================================================================
    // Agent: execute
    // =========================================================================================================

    /// @notice Moves `amount` of `token` from the mandate owner to an allowlisted recipient.
    /// @param ref Free 32-byte reference the agent attaches (e.g. a hash of its proposal); it is only logged.
    function executeTransfer(uint256 id, address token, address to, uint256 amount, bytes32 ref)
        external
        nonReentrant
        returns (uint64 actionNo)
    {
        uint256 reasons = _checkTransfer(id, msg.sender, token, to, amount);
        if (reasons != 0) revert Rejected(reasons);

        Mandate storage m = _mandates[id];
        (uint64 day, uint256 spent) = _record(id, token, amount);
        actionNo = ++m.actions;
        _pushTransfer(token, m.owner, to, amount);
        emit TransferExecuted(id, actionNo, msg.sender, token, to, amount, day, spent, ref);
    }

    /// @notice Swaps `o.amountIn` of the owner's `o.tokenIn` for `o.tokenOut` through an allowlisted Uniswap v3
    ///         SwapRouter02-compatible router. The output always goes to the owner; the agent only picks the pool
    ///         fee tier and a non-zero minimum output.
    function executeSwapV3(uint256 id, SwapOrder calldata o)
        external
        nonReentrant
        returns (uint64 actionNo, uint256 amountOut)
    {
        uint256 reasons = _checkSwap(id, msg.sender, o);
        if (reasons != 0) revert Rejected(reasons);

        Mandate storage m = _mandates[id];
        (uint64 day, uint256 spent) = _record(id, o.tokenIn, o.amountIn);
        actionNo = ++m.actions;

        amountOut = _swap(m.owner, o);
        _emitSwap(id, actionNo, o, amountOut, day, spent);
    }

    // =========================================================================================================
    // Views
    // =========================================================================================================

    /// @notice Reason bits a transfer would fail with right now if sent by `caller`. Zero means it would pass
    ///         the guard (the token itself can still refuse, e.g. a blocklisted address).
    function checkTransfer(uint256 id, address caller, address token, address to, uint256 amount)
        external
        view
        returns (uint256)
    {
        return _checkTransfer(id, caller, token, to, amount);
    }

    /// @notice Reason bits a swap would fail with right now if sent by `caller`.
    function checkSwap(uint256 id, address caller, SwapOrder calldata o) external view returns (uint256) {
        return _checkSwap(id, caller, o);
    }

    function getMandate(uint256 id) external view returns (Mandate memory) {
        return _mandates[id];
    }

    function tokenRule(uint256 id, address token) external view returns (TokenRule memory) {
        return _rules[id][token];
    }

    function isRecipient(uint256 id, address who) external view returns (bool) {
        return _recipientOk[id][who];
    }

    function isRouter(uint256 id, address who) external view returns (bool) {
        return _routerOk[id][who];
    }

    function tokensOf(uint256 id) external view returns (address[] memory) {
        return _members[id][SET_TOKENS];
    }

    function recipientsOf(uint256 id) external view returns (address[] memory) {
        return _members[id][SET_RECIPIENTS];
    }

    function routersOf(uint256 id) external view returns (address[] memory) {
        return _members[id][SET_ROUTERS];
    }

    function mandatesOfOwner(address owner_) external view returns (uint256[] memory) {
        return _byOwner[owner_];
    }

    function mandatesOfAgent(address agent) external view returns (uint256[] memory) {
        return _byAgent[agent];
    }

    /// @notice Spent today (calendar UTC day) and what is left under the daily cap.
    function spentToday(uint256 id, address token) public view returns (uint256 spent, uint256 left) {
        DaySpend memory s = _spent[id][token];
        spent = M.spentOn(s.day, s.spent, M.dayOf(block.timestamp));
        left = M.remaining(_rules[id][token].dailyCap, spent);
    }

    /// @notice Actions executed today and the per-day limit (0 = none).
    function actionsToday(uint256 id) external view returns (uint32 used, uint32 limit) {
        DayCount memory c = _count[id];
        used = c.day == M.dayOf(block.timestamp) ? c.count : 0;
        limit = _mandates[id].maxActionsPerDay;
    }

    // =========================================================================================================
    // Internal: checks
    // =========================================================================================================

    function _baseBits(uint256 id, address caller) internal view returns (uint256 bits, Mandate storage m) {
        m = _mandates[id];
        bits = M.stateBits(m.owner != address(0), m.revoked, m.paused, m.validFrom, m.expiry, block.timestamp);
        if (bits & M.R_UNKNOWN_MANDATE != 0) return (bits, m);
        if (caller != m.agent) bits |= M.R_NOT_AGENT;
        DayCount memory c = _count[id];
        bits |= M.countBits(m.maxActionsPerDay, c.day, c.count, M.dayOf(block.timestamp));
    }

    function _spendBits(uint256 id, address owner_, address token, uint256 amount) internal view returns (uint256 bits) {
        TokenRule memory r = _rules[id][token];
        if (!r.listed) return M.R_TOKEN_NOT_ALLOWED | (amount == 0 ? M.R_ZERO_AMOUNT : 0);
        DaySpend memory s = _spent[id][token];
        bits = M.amountBits(amount, r.perTxCap, r.dailyCap, M.spentOn(s.day, s.spent, M.dayOf(block.timestamp)));
        if (amount == 0) return bits;
        (bool okA, uint256 allowance_) = _tryRead(token, abi.encodeCall(IDeleqERC20.allowance, (owner_, address(this))));
        (bool okB, uint256 balance_) = _tryRead(token, abi.encodeCall(IDeleqERC20.balanceOf, (owner_)));
        if (!okA || !okB) return bits | M.R_TOKEN_UNREADABLE;
        if (allowance_ < amount) bits |= M.R_LOW_ALLOWANCE;
        if (balance_ < amount) bits |= M.R_LOW_BALANCE;
    }

    function _checkTransfer(uint256 id, address caller, address token, address to, uint256 amount)
        internal
        view
        returns (uint256 bits)
    {
        Mandate storage m;
        (bits, m) = _baseBits(id, caller);
        if (bits & M.R_UNKNOWN_MANDATE != 0) return bits;
        if (!_recipientOk[id][to]) bits |= M.R_RECIPIENT_NOT_ALLOWED;
        bits |= _spendBits(id, m.owner, token, amount);
    }

    function _checkSwap(uint256 id, address caller, SwapOrder calldata o) internal view returns (uint256 bits) {
        Mandate storage m;
        (bits, m) = _baseBits(id, caller);
        if (bits & M.R_UNKNOWN_MANDATE != 0) return bits;
        if (!_routerOk[id][o.router]) bits |= M.R_ROUTER_NOT_ALLOWED;
        if (o.tokenIn == o.tokenOut) bits |= M.R_SAME_TOKEN;
        if (!_rules[id][o.tokenOut].listed) bits |= M.R_TOKEN_OUT_NOT_ALLOWED;
        if (o.minOut == 0) bits |= M.R_NO_MIN_OUT;
        bits |= _spendBits(id, m.owner, o.tokenIn, o.amountIn);
    }

    // =========================================================================================================
    // Internal: effects and interactions
    // =========================================================================================================

    function _record(uint256 id, address token, uint256 amount) internal returns (uint64 day, uint256 total) {
        day = M.dayOf(block.timestamp);
        DaySpend storage s = _spent[id][token];
        total = M.spentOn(s.day, s.spent, day) + amount;
        s.day = day;
        s.spent = uint192(total); // total <= dailyCap <= type(uint128).max
        DayCount storage c = _count[id];
        uint32 used = c.day == day ? c.count : 0;
        c.day = day;
        c.count = used + 1;
    }

    function _swap(address owner_, SwapOrder calldata o) internal returns (uint256 amountOut) {
        uint256 inBefore = _balanceOf(o.tokenIn, address(this));
        _safeTransferFrom(o.tokenIn, owner_, address(this), o.amountIn);
        uint256 got = _balanceOf(o.tokenIn, address(this)) - inBefore;
        if (got != o.amountIn) revert FeeOnTransferNotSupported(o.amountIn, got);

        _forceApprove(o.tokenIn, o.router, o.amountIn);
        uint256 outBefore = _balanceOf(o.tokenOut, owner_);
        IDeleqSwapRouter02(o.router).exactInputSingle(
            IDeleqSwapRouter02.ExactInputSingleParams({
                tokenIn: o.tokenIn,
                tokenOut: o.tokenOut,
                fee: o.fee,
                recipient: owner_,
                amountIn: o.amountIn,
                amountOutMinimum: o.minOut,
                sqrtPriceLimitX96: 0
            })
        );
        // Measure what the owner actually received instead of trusting the router's return value.
        amountOut = _balanceOf(o.tokenOut, owner_) - outBefore;
        if (amountOut < o.minOut) revert SwapShortfall(amountOut, o.minOut);

        _forceApprove(o.tokenIn, o.router, 0);
        uint256 inAfter = _balanceOf(o.tokenIn, address(this));
        if (inAfter > inBefore) revert LeftoverBalance(o.tokenIn, inAfter - inBefore);
    }

    function _emitSwap(uint256 id, uint64 actionNo, SwapOrder calldata o, uint256 amountOut, uint64 day, uint256 spent)
        internal
    {
        emit SwapExecuted(
            id, actionNo, msg.sender, o.router, o.tokenIn, o.tokenOut, o.fee, o.amountIn, amountOut, day, spent, o.ref
        );
    }

    function _pushTransfer(address token, address from, address to, uint256 amount) internal {
        uint256 before = _balanceOf(token, to);
        _safeTransferFrom(token, from, to, amount);
        uint256 received = _balanceOf(token, to) - before;
        if (received != amount) revert FeeOnTransferNotSupported(amount, received);
    }

    function _pause(uint256 id) internal {
        Mandate storage m = _mandates[id];
        if (m.revoked) revert AlreadyRevoked();
        if (!m.paused) {
            m.paused = true;
            ++m.version;
            emit Paused(id, msg.sender);
        }
    }

    function _setTokenRule(uint256 id, address token, uint128 perTxCap, uint128 dailyCap, bool listed) internal {
        if (token == address(0) || token.code.length == 0) revert BadAddress();
        if (listed && perTxCap > dailyCap) revert BadCaps();
        if (!listed && (perTxCap != 0 || dailyCap != 0)) revert BadCaps();
        _rules[id][token] = TokenRule({perTxCap: perTxCap, dailyCap: dailyCap, listed: listed});
        _setMember(id, SET_TOKENS, token, listed, MAX_TOKENS);
        emit TokenRuleSet(id, token, perTxCap, dailyCap, listed, ++_mandates[id].version);
    }

    function _setRecipient(uint256 id, address recipient, bool allowed) internal {
        if (recipient == address(0) || recipient == address(this) || recipient == _mandates[id].owner) {
            revert BadAddress();
        }
        _recipientOk[id][recipient] = allowed;
        _setMember(id, SET_RECIPIENTS, recipient, allowed, MAX_RECIPIENTS);
        emit RecipientSet(id, recipient, allowed, ++_mandates[id].version);
    }

    function _setRouter(uint256 id, address router, bool allowed) internal {
        if (router == address(0) || router == address(this) || router.code.length == 0) revert BadAddress();
        _routerOk[id][router] = allowed;
        _setMember(id, SET_ROUTERS, router, allowed, MAX_ROUTERS);
        emit RouterSet(id, router, allowed, ++_mandates[id].version);
    }

    function _setMember(uint256 id, uint8 kind, address who, bool add, uint256 cap) internal {
        mapping(address => uint256) storage idx = _index[id][kind];
        address[] storage list = _members[id][kind];
        uint256 at = idx[who];
        if (add) {
            if (at != 0) return;
            if (list.length >= cap) revert TooMany();
            list.push(who);
            idx[who] = list.length;
        } else {
            if (at == 0) return;
            address last = list[list.length - 1];
            list[at - 1] = last;
            idx[last] = at;
            list.pop();
            delete idx[who];
        }
    }

    function _checkWindow(uint64 from, uint64 expiry) internal view {
        if (expiry <= from || expiry <= block.timestamp || expiry - from > MAX_DURATION) revert BadWindow();
    }

    function _notRevoked(uint256 id) internal view {
        if (_mandates[id].revoked) revert AlreadyRevoked();
    }

    // ---- token calls (no-return tokens accepted, false return refused) ------------------------------------

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        _callToken(token, abi.encodeWithSelector(0x23b872dd, from, to, amount));
    }

    function _forceApprove(address token, address spender, uint256 amount) internal {
        bytes memory data = abi.encodeWithSelector(0x095ea7b3, spender, amount);
        if (!_tryCallToken(token, data)) {
            _callToken(token, abi.encodeWithSelector(0x095ea7b3, spender, 0));
            _callToken(token, data);
        }
    }

    function _callToken(address token, bytes memory data) internal {
        if (!_tryCallToken(token, data)) revert TokenCallFailed(token);
    }

    function _tryCallToken(address token, bytes memory data) internal returns (bool) {
        if (token.code.length == 0) return false;
        (bool ok, bytes memory ret) = token.call(data);
        if (!ok) return false;
        if (ret.length == 0) return true;
        if (ret.length < 32) return false;
        return abi.decode(ret, (uint256)) == 1;
    }

    function _balanceOf(address token, address who) internal view returns (uint256 bal) {
        (bool ok, uint256 v) = _tryRead(token, abi.encodeCall(IDeleqERC20.balanceOf, (who)));
        if (!ok) revert TokenCallFailed(token);
        return v;
    }

    function _tryRead(address token, bytes memory data) internal view returns (bool, uint256) {
        if (token.code.length == 0) return (false, 0);
        (bool ok, bytes memory ret) = token.staticcall(data);
        if (!ok || ret.length < 32) return (false, 0);
        return (true, abi.decode(ret, (uint256)));
    }
}
