// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {DeleqMandateGuard} from "../src/DeleqMandateGuard.sol";
import {DeleqLimitMath as M} from "../src/DeleqLimitMath.sol";
import {
    DeleqTestToken,
    DeleqNoReturnToken,
    DeleqFalseToken,
    DeleqFeeToken,
    DeleqReentrantToken,
    DeleqMockRouter
} from "./DeleqMocks.sol";

contract DeleqMandateGuardTest is Test {
    DeleqMandateGuard g;
    DeleqTestToken usd;
    DeleqTestToken weth;
    DeleqMockRouter router;

    address owner = address(0xA11CE);
    address agent = address(0xB0B);
    address shop = address(0x5409);
    address stranger = address(0xBAD);

    uint256 constant T0 = 1_800_000_000; // a Wednesday, 03:20 UTC

    function setUp() public {
        vm.warp(T0);
        g = new DeleqMandateGuard();
        usd = new DeleqTestToken("Test Dollar", "TUSD", 6);
        weth = new DeleqTestToken("Wrapped", "WETH", 18);
        router = new DeleqMockRouter();
        usd.mint(owner, 1_000_000e6);
        vm.prank(owner);
        usd.approve(address(g), type(uint256).max);
    }

    // ---- helpers ------------------------------------------------------------------------------------------

    function _init(uint128 perTx, uint128 daily) internal view returns (DeleqMandateGuard.MandateInit memory i) {
        i.agent = agent;
        i.expiry = uint64(T0 + 30 days);
        i.label = bytes32("test");
        i.tokens = new DeleqMandateGuard.TokenInit[](2);
        i.tokens[0] = DeleqMandateGuard.TokenInit(address(usd), perTx, daily);
        i.tokens[1] = DeleqMandateGuard.TokenInit(address(weth), 0, 0);
        i.recipients = new address[](1);
        i.recipients[0] = shop;
        i.routers = new address[](1);
        i.routers[0] = address(router);
    }

    function _create(uint128 perTx, uint128 daily) internal returns (uint256 id) {
        vm.prank(owner);
        id = g.createMandate(_init(perTx, daily));
    }

    function _pay(uint256 id, uint256 amount) internal returns (uint64) {
        vm.prank(agent);
        return g.executeTransfer(id, address(usd), shop, amount, bytes32("p"));
    }

    function _order(uint256 amountIn, uint256 minOut) internal view returns (DeleqMandateGuard.SwapOrder memory o) {
        o = DeleqMandateGuard.SwapOrder(address(router), address(usd), address(weth), 500, amountIn, minOut, bytes32("s"));
    }

    // ---- create -------------------------------------------------------------------------------------------

    function test_createStoresEverything() public {
        uint256 id = _create(100e6, 250e6);
        DeleqMandateGuard.Mandate memory m = g.getMandate(id);
        assertEq(m.owner, owner);
        assertEq(m.agent, agent);
        assertEq(m.validFrom, T0);
        assertEq(m.expiry, T0 + 30 days);
        assertEq(g.tokensOf(id).length, 2);
        assertEq(g.recipientsOf(id)[0], shop);
        assertEq(g.routersOf(id)[0], address(router));
        assertEq(g.mandatesOfOwner(owner)[0], id);
        assertEq(g.mandatesOfAgent(agent)[0], id);
        assertTrue(g.isRecipient(id, shop));
        assertEq(g.tokenRule(id, address(usd)).dailyCap, 250e6);
    }

    function test_createRejectsBadInput() public {
        DeleqMandateGuard.MandateInit memory i = _init(1, 2);
        i.agent = owner;
        vm.prank(owner);
        vm.expectRevert(DeleqMandateGuard.BadAgent.selector);
        g.createMandate(i);

        i = _init(1, 2);
        i.expiry = uint64(T0);
        vm.prank(owner);
        vm.expectRevert(DeleqMandateGuard.BadWindow.selector);
        g.createMandate(i);

        i = _init(1, 2);
        i.expiry = uint64(T0 + 800 days);
        vm.prank(owner);
        vm.expectRevert(DeleqMandateGuard.BadWindow.selector);
        g.createMandate(i);

        i = _init(5, 2); // per-tx above daily
        vm.prank(owner);
        vm.expectRevert(DeleqMandateGuard.BadCaps.selector);
        g.createMandate(i);

        i = _init(1, 2);
        i.recipients[0] = owner; // paying yourself is not a recipient
        vm.prank(owner);
        vm.expectRevert(DeleqMandateGuard.BadAddress.selector);
        g.createMandate(i);

        i = _init(1, 2);
        i.tokens[0].token = address(0x1234); // no code
        vm.prank(owner);
        vm.expectRevert(DeleqMandateGuard.BadAddress.selector);
        g.createMandate(i);

        i = _init(1, 2);
        i.routers[0] = address(0x9999); // no code
        vm.prank(owner);
        vm.expectRevert(DeleqMandateGuard.BadAddress.selector);
        g.createMandate(i);
    }

    // ---- transfer: happy path and every rejection ---------------------------------------------------------

    function test_transferMovesOwnerFundsAndLogs() public {
        uint256 id = _create(100e6, 250e6);
        vm.expectEmit(true, true, true, true);
        emit DeleqMandateGuard.TransferExecuted(id, 1, agent, address(usd), shop, 60e6, uint64(T0 / 1 days), 60e6, bytes32("p"));
        _pay(id, 60e6);
        assertEq(usd.balanceOf(shop), 60e6);
        assertEq(usd.balanceOf(address(g)), 0);
        (uint256 spent, uint256 left) = g.spentToday(id, address(usd));
        assertEq(spent, 60e6);
        assertEq(left, 190e6);
        assertEq(g.getMandate(id).actions, 1);
    }

    function test_rejectsOverPerTx() public {
        uint256 id = _create(100e6, 250e6);
        assertEq(g.checkTransfer(id, agent, address(usd), shop, 101e6), M.R_OVER_PER_TX);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(DeleqMandateGuard.Rejected.selector, M.R_OVER_PER_TX));
        g.executeTransfer(id, address(usd), shop, 101e6, 0);
    }

    function test_dailyCapAndUtcReset() public {
        uint256 id = _create(100e6, 250e6);
        _pay(id, 100e6);
        _pay(id, 100e6);
        assertEq(g.checkTransfer(id, agent, address(usd), shop, 51e6), M.R_OVER_DAILY);
        _pay(id, 50e6); // exactly the cap
        assertEq(g.checkTransfer(id, agent, address(usd), shop, 1), M.R_OVER_DAILY);
        // one second before UTC midnight: still the same day
        uint256 midnight = (T0 / 1 days + 1) * 1 days;
        vm.warp(midnight - 1);
        assertEq(g.checkTransfer(id, agent, address(usd), shop, 1), M.R_OVER_DAILY);
        vm.warp(midnight);
        assertEq(g.checkTransfer(id, agent, address(usd), shop, 100e6), 0);
        (uint256 spent,) = g.spentToday(id, address(usd));
        assertEq(spent, 0);
        _pay(id, 100e6);
    }

    function test_actionCountPerDay() public {
        DeleqMandateGuard.MandateInit memory i = _init(100e6, 1000e6);
        i.maxActionsPerDay = 2;
        vm.prank(owner);
        uint256 id = g.createMandate(i);
        _pay(id, 1e6);
        _pay(id, 1e6);
        assertEq(g.checkTransfer(id, agent, address(usd), shop, 1e6), M.R_DAILY_COUNT);
        (uint32 used, uint32 limit) = g.actionsToday(id);
        assertEq(used, 2);
        assertEq(limit, 2);
        vm.warp(T0 + 1 days);
        assertEq(g.checkTransfer(id, agent, address(usd), shop, 1e6), 0);
    }

    function test_rejectionBitsCombine() public {
        uint256 id = _create(100e6, 250e6);
        uint256 bits = g.checkTransfer(id, stranger, address(weth), stranger, 5);
        // weth is listed with zero caps: over per-tx and daily; plus not agent, recipient
        assertEq(bits, M.R_NOT_AGENT | M.R_RECIPIENT_NOT_ALLOWED | M.R_OVER_PER_TX | M.R_OVER_DAILY | M.R_LOW_ALLOWANCE | M.R_LOW_BALANCE);
        assertEq(g.checkTransfer(id, agent, address(0x1234), shop, 5), M.R_TOKEN_NOT_ALLOWED);
        assertEq(g.checkTransfer(id, agent, address(usd), shop, 0), M.R_ZERO_AMOUNT);
        assertEq(g.checkTransfer(999, agent, address(usd), shop, 1), M.R_UNKNOWN_MANDATE);
    }

    function test_strangerCannotExecute() public {
        uint256 id = _create(100e6, 250e6);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(DeleqMandateGuard.Rejected.selector, M.R_NOT_AGENT));
        g.executeTransfer(id, address(usd), shop, 1e6, 0);
        vm.prank(owner); // even the owner is not the agent
        vm.expectRevert(abi.encodeWithSelector(DeleqMandateGuard.Rejected.selector, M.R_NOT_AGENT));
        g.executeTransfer(id, address(usd), shop, 1e6, 0);
    }

    function test_lowAllowanceAndBalance() public {
        uint256 id = _create(100e6, 250e6);
        vm.prank(owner);
        usd.approve(address(g), 5e6);
        assertEq(g.checkTransfer(id, agent, address(usd), shop, 6e6), M.R_LOW_ALLOWANCE);
        uint256 bal = usd.balanceOf(owner);
        vm.prank(owner);
        usd.transfer(stranger, bal - 1e6);
        assertEq(g.checkTransfer(id, agent, address(usd), shop, 6e6), M.R_LOW_ALLOWANCE | M.R_LOW_BALANCE);
    }

    function test_windowNotStartedAndExpired() public {
        DeleqMandateGuard.MandateInit memory i = _init(100e6, 250e6);
        i.validFrom = uint64(T0 + 1 hours);
        vm.prank(owner);
        uint256 id = g.createMandate(i);
        assertEq(g.checkTransfer(id, agent, address(usd), shop, 1e6), M.R_NOT_STARTED);
        vm.warp(T0 + 1 hours);
        assertEq(g.checkTransfer(id, agent, address(usd), shop, 1e6), 0);
        vm.warp(T0 + 30 days);
        assertEq(g.checkTransfer(id, agent, address(usd), shop, 1e6), M.R_EXPIRED);
    }

    // ---- owner controls take effect in the same block -----------------------------------------------------

    function test_pauseSameBlockAndUnpause() public {
        uint256 id = _create(100e6, 250e6);
        _pay(id, 1e6);
        vm.prank(owner);
        g.pause(id);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(DeleqMandateGuard.Rejected.selector, M.R_PAUSED));
        g.executeTransfer(id, address(usd), shop, 1e6, 0);
        vm.prank(owner);
        g.unpause(id);
        _pay(id, 1e6);
    }

    function test_revokeIsFinal() public {
        uint256 id = _create(100e6, 250e6);
        vm.prank(owner);
        g.revoke(id);
        assertEq(g.checkTransfer(id, agent, address(usd), shop, 1e6), M.R_REVOKED);
        vm.startPrank(owner);
        vm.expectRevert(DeleqMandateGuard.AlreadyRevoked.selector);
        g.unpause(id);
        vm.expectRevert(DeleqMandateGuard.AlreadyRevoked.selector);
        g.setTokenRule(id, address(usd), 1, 1, true);
        vm.expectRevert(DeleqMandateGuard.AlreadyRevoked.selector);
        g.revoke(id);
        vm.stopPrank();
    }

    function test_agentCanPauseButNotUnpauseOrRaise() public {
        uint256 id = _create(100e6, 250e6);
        vm.startPrank(agent);
        vm.expectRevert(DeleqMandateGuard.NotOwner.selector);
        g.setTokenRule(id, address(usd), 1000e6, 1000e6, true);
        vm.expectRevert(DeleqMandateGuard.NotOwner.selector);
        g.setRecipient(id, stranger, true);
        vm.expectRevert(DeleqMandateGuard.NotOwner.selector);
        g.setRouter(id, address(usd), true);
        vm.expectRevert(DeleqMandateGuard.NotOwner.selector);
        g.setWindow(id, uint64(T0), uint64(T0 + 700 days));
        vm.expectRevert(DeleqMandateGuard.NotOwner.selector);
        g.setMaxActionsPerDay(id, 0);
        vm.expectRevert(DeleqMandateGuard.NotOwner.selector);
        g.revoke(id);
        g.agentPause(id);
        vm.expectRevert(DeleqMandateGuard.NotOwner.selector);
        g.unpause(id);
        vm.stopPrank();
        assertTrue(g.getMandate(id).paused);
        vm.prank(stranger);
        vm.expectRevert(DeleqMandateGuard.NotAgent.selector);
        g.agentPause(id);
    }

    function test_ownerEditsBumpVersionAndLists() public {
        uint256 id = _create(100e6, 250e6);
        uint32 v0 = g.getMandate(id).version;
        vm.startPrank(owner);
        g.setRecipient(id, stranger, true);
        g.setRecipient(id, shop, false);
        g.setTokenRule(id, address(weth), 0, 0, false);
        g.setMaxActionsPerDay(id, 3);
        g.setWindow(id, uint64(T0), uint64(T0 + 10 days));
        vm.stopPrank();
        assertEq(g.getMandate(id).version, v0 + 5);
        address[] memory r = g.recipientsOf(id);
        assertEq(r.length, 1);
        assertEq(r[0], stranger);
        assertEq(g.tokensOf(id).length, 1);
        assertEq(g.checkTransfer(id, agent, address(usd), shop, 1e6), M.R_RECIPIENT_NOT_ALLOWED);
        vm.prank(owner);
        vm.expectRevert(DeleqMandateGuard.BadCaps.selector);
        g.setTokenRule(id, address(weth), 1, 1, false);
    }

    function test_listCaps() public {
        uint256 id = _create(100e6, 250e6);
        vm.startPrank(owner);
        for (uint160 k = 1; k < 32; ++k) g.setRecipient(id, address(0x1000 + k), true);
        vm.expectRevert(DeleqMandateGuard.TooMany.selector);
        g.setRecipient(id, address(0x2000), true);
        vm.stopPrank();
    }

    function test_onlyOwnerOfThatMandate() public {
        uint256 id = _create(100e6, 250e6);
        vm.prank(stranger);
        vm.expectRevert(DeleqMandateGuard.NotOwner.selector);
        g.pause(id);
        vm.prank(stranger);
        vm.expectRevert(DeleqMandateGuard.NotOwner.selector);
        g.pause(777); // unknown id has owner 0
    }

    // ---- hostile tokens -----------------------------------------------------------------------------------

    function test_noReturnTokenWorks() public {
        DeleqNoReturnToken t = new DeleqNoReturnToken();
        t.mint(owner, 100e6);
        vm.prank(owner);
        t.approve(address(g), type(uint256).max);
        DeleqMandateGuard.MandateInit memory i = _init(10e6, 20e6);
        i.tokens[0].token = address(t);
        vm.prank(owner);
        uint256 id = g.createMandate(i);
        vm.prank(agent);
        g.executeTransfer(id, address(t), shop, 10e6, 0);
        assertEq(t.balanceOf(shop), 10e6);
    }

    function test_falseReturningTokenRefused() public {
        DeleqFalseToken t = new DeleqFalseToken();
        t.mint(owner, 100e6);
        vm.prank(owner);
        t.approve(address(g), type(uint256).max);
        DeleqMandateGuard.MandateInit memory i = _init(10e6, 20e6);
        i.tokens[0].token = address(t);
        vm.prank(owner);
        uint256 id = g.createMandate(i);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(DeleqMandateGuard.TokenCallFailed.selector, address(t)));
        g.executeTransfer(id, address(t), shop, 10e6, 0);
    }

    function test_feeOnTransferRefused() public {
        DeleqFeeToken t = new DeleqFeeToken();
        t.mint(owner, 100e18);
        vm.prank(owner);
        t.approve(address(g), type(uint256).max);
        DeleqMandateGuard.MandateInit memory i = _init(10e18, 20e18);
        i.tokens[0].token = address(t);
        vm.prank(owner);
        uint256 id = g.createMandate(i);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(DeleqMandateGuard.FeeOnTransferNotSupported.selector, 10e18, 9.9e18));
        g.executeTransfer(id, address(t), shop, 10e18, 0);
        (uint256 spent,) = g.spentToday(id, address(t));
        assertEq(spent, 0); // the whole call reverted, nothing recorded
    }

    function test_reentrancyBlocked() public {
        DeleqReentrantToken t = new DeleqReentrantToken();
        t.mint(owner, 100e18);
        vm.prank(owner);
        t.approve(address(g), type(uint256).max);
        DeleqMandateGuard.MandateInit memory i = _init(10e18, 100e18);
        i.agent = address(t); // worst case: the token itself is the agent
        i.tokens[0].token = address(t);
        vm.prank(owner);
        uint256 id = g.createMandate(i);
        t.arm(g, id, shop);
        vm.prank(address(t));
        g.executeTransfer(id, address(t), shop, 10e18, 0);
        assertTrue(t.attacked());
        assertEq(bytes4(t.lastError()), DeleqMandateGuard.Reentrancy.selector);
        assertEq(t.balanceOf(shop), 10e18); // only the outer transfer happened
        (uint256 spent,) = g.spentToday(id, address(t));
        assertEq(spent, 10e18);
    }

    // ---- swaps --------------------------------------------------------------------------------------------

    function test_swapOutputGoesToOwner() public {
        uint256 id = _create(100e6, 250e6);
        vm.prank(agent);
        (uint64 n, uint256 out) = g.executeSwapV3(id, _order(10e6, 19e6));
        assertEq(n, 1);
        assertEq(out, 20e6);
        assertEq(weth.balanceOf(owner), 20e6);
        assertEq(router.lastRecipient(), owner);
        assertEq(usd.balanceOf(address(g)), 0);
        assertEq(usd.allowance(address(g), address(router)), 0);
        (uint256 spent,) = g.spentToday(id, address(usd));
        assertEq(spent, 10e6);
    }

    function test_swapRejections() public {
        uint256 id = _create(100e6, 250e6);
        DeleqMandateGuard.SwapOrder memory o = _order(10e6, 0);
        assertEq(g.checkSwap(id, agent, o), M.R_NO_MIN_OUT);
        o = _order(10e6, 1);
        o.router = address(usd);
        assertEq(g.checkSwap(id, agent, o), M.R_ROUTER_NOT_ALLOWED);
        o = _order(10e6, 1);
        o.tokenOut = address(usd);
        assertEq(g.checkSwap(id, agent, o), M.R_SAME_TOKEN);
        o = _order(10e6, 1);
        o.tokenOut = address(router); // not listed
        assertEq(g.checkSwap(id, agent, o), M.R_TOKEN_OUT_NOT_ALLOWED);
        o = _order(500e6, 1);
        assertEq(g.checkSwap(id, agent, o), M.R_OVER_PER_TX | M.R_OVER_DAILY);
    }

    function test_lyingRouterReverts() public {
        uint256 id = _create(100e6, 250e6);
        router.setPayElsewhere(true);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(DeleqMandateGuard.SwapShortfall.selector, 0, 1));
        g.executeSwapV3(id, _order(10e6, 1));
    }

    function test_routerThatLeavesTokensReverts() public {
        uint256 id = _create(100e6, 250e6);
        router.setPullBps(5_000);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(DeleqMandateGuard.LeftoverBalance.selector, address(usd), 5e6));
        g.executeSwapV3(id, _order(10e6, 1));
    }

    function test_swapWithNoReturnTokenApprovesThroughZero() public {
        DeleqNoReturnToken t = new DeleqNoReturnToken();
        t.mint(owner, 100e6);
        vm.prank(owner);
        t.approve(address(g), type(uint256).max);
        DeleqMandateGuard.MandateInit memory i = _init(10e6, 20e6);
        i.tokens[0].token = address(t);
        vm.prank(owner);
        uint256 id = g.createMandate(i);
        DeleqMandateGuard.SwapOrder memory o = _order(10e6, 1);
        o.tokenIn = address(t);
        vm.prank(agent);
        g.executeSwapV3(id, o);
        assertEq(t.allowance(address(g), address(router)), 0);
        assertEq(weth.balanceOf(owner), 20e6);
    }

    // ---- fuzz ---------------------------------------------------------------------------------------------

    function testFuzz_transferMatchesMath(uint128 perTx, uint128 daily, uint96 a1, uint96 a2, uint32 dt) public {
        daily = uint128(bound(daily, 1, 1e30));
        perTx = uint128(bound(perTx, 0, daily));
        usd.mint(owner, type(uint96).max);
        uint256 id = _create(perTx, daily);
        uint256 spent;
        uint256[2] memory amounts = [uint256(a1), uint256(a2)];
        for (uint256 k; k < 2; ++k) {
            if (k == 1) {
                uint256 before = block.timestamp / 1 days;
                vm.warp(block.timestamp + bound(dt, 0, 2 days));
                if (block.timestamp / 1 days != before) spent = 0;
            }
            uint256 amt = amounts[k];
            uint256 expected = M.amountBits(amt, perTx, daily, spent);
            if (amt > usd.balanceOf(owner)) expected |= M.R_LOW_BALANCE;
            uint256 got = g.checkTransfer(id, agent, address(usd), shop, amt);
            assertEq(got, expected);
            if (got == 0) {
                _pay(id, amt);
                spent += amt;
            }
            assertLe(spent, daily);
        }
    }

    function testFuzz_strangerNeverMovesFunds(address who, uint96 amount) public {
        vm.assume(who != agent);
        uint256 id = _create(100e6, 250e6);
        uint256 before = usd.balanceOf(owner);
        vm.prank(who);
        try g.executeTransfer(id, address(usd), shop, amount, 0) {
            fail();
        } catch {}
        assertEq(usd.balanceOf(owner), before);
    }
}
