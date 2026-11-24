// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {DeleqMandateGuard} from "../src/DeleqMandateGuard.sol";

/// @notice Plain ERC-20 for tests.
contract DeleqTestToken {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory n, string memory s, uint8 d) {
        name = n;
        symbol = s;
        decimals = d;
    }

    function mint(address to, uint256 v) external {
        balanceOf[to] += v;
        totalSupply += v;
    }

    function approve(address s, uint256 v) public virtual returns (bool) {
        allowance[msg.sender][s] = v;
        return true;
    }

    function transfer(address to, uint256 v) public virtual returns (bool) {
        _move(msg.sender, to, v);
        return true;
    }

    function transferFrom(address f, address to, uint256 v) public virtual returns (bool) {
        _spend(f, v);
        _move(f, to, v);
        return true;
    }

    function _spend(address f, uint256 v) internal {
        uint256 a = allowance[f][msg.sender];
        require(a >= v, "allowance");
        if (a != type(uint256).max) allowance[f][msg.sender] = a - v;
    }

    function _move(address f, address to, uint256 v) internal virtual {
        require(balanceOf[f] >= v, "balance");
        balanceOf[f] -= v;
        balanceOf[to] += v;
    }
}

/// @notice USDT-style: no return values, approve must go through zero.
contract DeleqNoReturnToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 v) external {
        balanceOf[to] += v;
    }

    function approve(address s, uint256 v) external {
        require(v == 0 || allowance[msg.sender][s] == 0, "approve via zero");
        allowance[msg.sender][s] = v;
    }

    function transfer(address to, uint256 v) external {
        require(balanceOf[msg.sender] >= v, "balance");
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
    }

    function transferFrom(address f, address to, uint256 v) external {
        require(allowance[f][msg.sender] >= v && balanceOf[f] >= v, "nope");
        allowance[f][msg.sender] -= v;
        balanceOf[f] -= v;
        balanceOf[to] += v;
    }
}

/// @notice Returns false instead of reverting.
contract DeleqFalseToken is DeleqTestToken("False", "FALSE", 18) {
    function transferFrom(address, address, uint256) public pure override returns (bool) {
        return false;
    }
}

/// @notice Takes 1% on every move.
contract DeleqFeeToken is DeleqTestToken("Fee", "FEE", 18) {
    function _move(address f, address to, uint256 v) internal override {
        require(balanceOf[f] >= v, "balance");
        uint256 fee = v / 100;
        balanceOf[f] -= v;
        balanceOf[to] += v - fee;
        balanceOf[address(0xdead)] += fee;
    }
}

/// @notice Calls back into the guard during transferFrom.
contract DeleqReentrantToken is DeleqTestToken("Re", "RE", 18) {
    DeleqMandateGuard public guard;
    uint256 public id;
    address public to;
    bool public attacked;
    bytes public lastError;

    function arm(DeleqMandateGuard g, uint256 i, address t) external {
        guard = g;
        id = i;
        to = t;
    }

    function transferFrom(address f, address t, uint256 v) public override returns (bool) {
        if (address(guard) != address(0) && !attacked) {
            attacked = true;
            try guard.executeTransfer(id, address(this), to, v, bytes32("re")) {} catch (bytes memory e) {
                lastError = e;
            }
        }
        return super.transferFrom(f, t, v);
    }
}

/// @notice SwapRouter02-shaped router: pulls amountIn, pays `rate` tokenOut per tokenIn (1e18 scale) to the recipient.
contract DeleqMockRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    uint256 public rate = 2e18;
    uint256 public pullBps = 10_000; // share of amountIn actually pulled
    bool public payElsewhere;
    address public lastRecipient;

    function setRate(uint256 r) external {
        rate = r;
    }

    function setPullBps(uint256 b) external {
        pullBps = b;
    }

    function setPayElsewhere(bool v) external {
        payElsewhere = v;
    }

    function exactInputSingle(ExactInputSingleParams calldata p) external payable returns (uint256 out) {
        uint256 pull = (p.amountIn * pullBps) / 10_000;
        (bool ok,) = p.tokenIn.call(abi.encodeWithSelector(0x23b872dd, msg.sender, address(this), pull));
        require(ok, "pull");
        out = (p.amountIn * rate) / 1e18;
        lastRecipient = p.recipient;
        // A lying router: reports `out` but pays a third party.
        DeleqTestToken(p.tokenOut).mint(payElsewhere ? address(0xbeef) : p.recipient, out);
        require(payElsewhere || out >= p.amountOutMinimum, "Too little received");
    }
}
