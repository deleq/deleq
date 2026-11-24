// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {DeleqMandateGuard} from "../src/DeleqMandateGuard.sol";
import {DeleqTestToken, DeleqMockRouter} from "./DeleqMocks.sol";

/// @notice Random agents, owners and strangers hit one mandate across several UTC days.
contract DeleqGuardActor is Test {
    DeleqMandateGuard public g;
    DeleqTestToken public usd;
    DeleqTestToken public weth;
    DeleqMockRouter public router;
    uint256 public id;
    address public owner = address(0xA11CE);
    address public agent = address(0xB0B);
    address public shop = address(0x5409);

    uint128 public constant PER_TX = 100e6;
    uint128 public constant DAILY = 250e6;

    mapping(uint256 => uint256) public movedOnDay; // UTC day => tokens that left the owner
    uint256[] public days_;
    uint256 public movedWhilePaused;
    uint256 public strangerSuccess;
    uint256 public executed;

    constructor() {
        g = new DeleqMandateGuard();
        usd = new DeleqTestToken("T", "T", 6);
        weth = new DeleqTestToken("W", "W", 18);
        router = new DeleqMockRouter();
        usd.mint(owner, 1e15);
        vm.prank(owner);
        usd.approve(address(g), type(uint256).max);
        DeleqMandateGuard.MandateInit memory i;
        i.agent = agent;
        i.expiry = uint64(block.timestamp + 700 days);
        i.maxActionsPerDay = 5;
        i.tokens = new DeleqMandateGuard.TokenInit[](2);
        i.tokens[0] = DeleqMandateGuard.TokenInit(address(usd), PER_TX, DAILY);
        i.tokens[1] = DeleqMandateGuard.TokenInit(address(weth), 0, 0);
        i.recipients = new address[](1);
        i.recipients[0] = shop;
        i.routers = new address[](1);
        i.routers[0] = address(router);
        vm.prank(owner);
        id = g.createMandate(i);
    }

    function _note(uint256 amount) internal {
        uint256 d = block.timestamp / 1 days;
        executed++;
        if (movedOnDay[d] == 0) days_.push(d);
        movedOnDay[d] += amount;
        if (g.getMandate(id).paused) movedWhilePaused += amount;
    }

    function pay(uint256 amount) external {
        amount = bound(amount, 0, 150e6);
        vm.prank(agent);
        try g.executeTransfer(id, address(usd), shop, amount, 0) {
            _note(amount);
        } catch {}
    }

    function swap(uint256 amount, uint256 minOut) external {
        amount = bound(amount, 0, 150e6);
        minOut = bound(minOut, 0, amount * 3);
        DeleqMandateGuard.SwapOrder memory o =
            DeleqMandateGuard.SwapOrder(address(router), address(usd), address(weth), 500, amount, minOut, 0);
        vm.prank(agent);
        try g.executeSwapV3(id, o) {
            _note(amount);
        } catch {}
    }

    function stranger(address who, uint256 amount) external {
        if (who == agent) return;
        vm.prank(who);
        try g.executeTransfer(id, address(usd), who, bound(amount, 0, 150e6), 0) {
            strangerSuccess++;
        } catch {}
    }

    function togglePause(bool on) external {
        vm.prank(owner);
        if (on) g.pause(id);
        else g.unpause(id);
    }

    function wait(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 0, 30 hours));
    }

    function dayCount() external view returns (uint256) {
        return days_.length;
    }
}

contract DeleqMandateGuardInvariantTest is Test {
    DeleqGuardActor h;

    function setUp() public {
        vm.warp(1_800_000_000);
        h = new DeleqGuardActor();
        targetContract(address(h));
    }

    /// The guard never holds a balance at rest.
    function invariant_holdsNothing() public view {
        assertEq(h.usd().balanceOf(address(h.g())), 0);
        assertEq(h.weth().balanceOf(address(h.g())), 0);
        assertEq(h.usd().allowance(address(h.g()), address(h.router())), 0);
    }

    /// No UTC day ever moves more than the daily cap.
    function invariant_dailyCapHolds() public view {
        for (uint256 k; k < h.dayCount(); ++k) {
            assertLe(h.movedOnDay(h.days_(k)), h.DAILY());
        }
    }

    /// Nothing moves while paused, and nobody but the agent ever moves anything.
    /// The handler really executes (a handler whose calls always fail would prove nothing).
    function test_handlerExecutes() public {
        h.pay(50e6);
        h.swap(40e6, 1);
        h.pay(100e6);
        h.pay(100e6); // over the daily cap: refused
        assertEq(h.executed(), 3);
        h.wait(30 hours);
        h.pay(100e6);
        assertEq(h.executed(), 4);
    }

    function invariant_pauseAndAgentOnly() public view {
        assertEq(h.movedWhilePaused(), 0);
        assertEq(h.strangerSuccess(), 0);
    }

    /// Owner funds only go to the shop (transfers) or the router (swaps).
    function invariant_accounting() public view {
        uint256 total;
        for (uint256 k; k < h.dayCount(); ++k) total += h.movedOnDay(h.days_(k));
        assertEq(h.usd().balanceOf(h.owner()) + total, 1e15);
        assertEq(h.usd().balanceOf(h.shop()) + h.usd().balanceOf(address(h.router())), total);
    }
}
