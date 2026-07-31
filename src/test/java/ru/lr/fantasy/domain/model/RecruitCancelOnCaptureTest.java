package ru.lr.fantasy.domain.model;

import org.junit.Test;
import ru.lr.fantasy.domain.model.action.NewRecruitsAction;
import ru.lr.fantasy.domain.model.building.BarrackBuilding;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class RecruitCancelOnCaptureTest {

    @Test
    public void assignLandOwnerCancelsPendingRecruitsForLand() {
        Player a = new Player(1, "A");
        a.setId(1L);
        Player b = new Player(1, "B");
        b.setId(2L);

        World world = new WorldFactory(a, b).create(3, 3);
        Land landA = world.getPlayerLands(a).get(0);
        landA.addBuilding(new BarrackBuilding());

        int tc = RecruitRules.turnCountFor(WarriorType.FIGHTER);
        world.getTurn().acceptAction(new NewRecruitsAction(world, landA, WarriorType.FIGHTER, 40, tc));
        assertEquals(1, world.getTurn().pendingRecruitSlots(landA, RecruitRules.SlotPool.BARRACK));

        world.assignLandOwner(landA, b);
        assertEquals(0, world.getTurn().pendingRecruitSlots(landA, RecruitRules.SlotPool.BARRACK));
        assertTrue(b.equals(landA.getPlayer()));
    }
}
