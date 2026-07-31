package ru.lr.fantasy.domain.model;

import org.junit.Test;
import ru.lr.fantasy.domain.model.action.BuildBuildingAction;
import ru.lr.fantasy.domain.model.action.NewRecruitsAction;
import ru.lr.fantasy.domain.model.action.WarriorsMoveInAction;
import ru.lr.fantasy.domain.model.action.WarriorsMoveOutAction;
import ru.lr.fantasy.domain.model.building.BarrackBuilding;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

public class TurnTest {

    @Test
    public void testTakeWarriorsOneTurn() {
        Player dal = new Player(3, "Dal");
        World world = new WorldFactory(dal).create(4, 4);

        Land playerLand = world.getPlayerLands(dal).get(0);

        System.out.println(world);

        Turn turn = world.getTurn();

        turn.acceptAction(new BuildBuildingAction(world, playerLand, new BarrackBuilding()));
        turn.acceptAction(new NewRecruitsAction(world, playerLand, WarriorType.FIGHTER, 20, 1));

        turn.doTurn();

        System.out.println(world);

        assertEquals(1, playerLand.getWarriors().size());
        Warrior actual = playerLand.getWarriors().get(0);
        assertEquals(WarriorType.FIGHTER, actual.getType());
        assertEquals(20, actual.getCount());
    }

    @Test
    public void testTakeWarriorsTwoTurn() {
        Player dal = new Player(3, "Dal");
        World world = new WorldFactory(dal).create(4, 4);

        Land palyerLand = world.getPlayerLands(dal).get(0);

        System.out.println(world);

        Turn turn = world.getTurn();

        turn.acceptAction(new BuildBuildingAction(world, palyerLand, new BarrackBuilding()));
        turn.acceptAction(new NewRecruitsAction(world, palyerLand, WarriorType.FIGHTER, 20, 1));
        turn.doTurn();

        System.out.println(world);

        turn.acceptAction(new NewRecruitsAction(world, palyerLand, WarriorType.FIGHTER, 20, 1));
        turn.acceptAction(new NewRecruitsAction(world, palyerLand, WarriorType.FIGHTER, 20, 1));
        turn.acceptAction(new NewRecruitsAction(world, palyerLand, WarriorType.FIGHTER, 20, 1));
        turn.doTurn();

        System.out.println(world);

        assertEquals(1, palyerLand.getWarriors().size());
        Warrior actual = palyerLand.getWarriors().get(0);
        assertEquals(WarriorType.FIGHTER, actual.getType());
        assertEquals(80, actual.getCount());
    }

    @Test
    public void testTakeWarriorsAndMove() {
        Player dal = new Player(3, "Dal");
        World world = new WorldFactory(dal).create(4, 4);

        Land playerLand = world.getPlayerLands(dal).get(0);

        System.out.println(world);

        Turn turn = world.getTurn();

        turn.acceptAction(new BuildBuildingAction(world, playerLand, new BarrackBuilding()));
        turn.acceptAction(new NewRecruitsAction(world, playerLand, WarriorType.FIGHTER, 20, 1));
        turn.doTurn();

        System.out.println(world);

        Land toLand = playerLand.getNeighboring().get(0);

        turn.acceptAction(new WarriorsMoveOutAction(world, playerLand, new Warrior(WarriorType.FIGHTER, 20)));
        turn.acceptAction(new WarriorsMoveInAction(world, toLand, dal, 2, new Warrior(WarriorType.FIGHTER, 20)));
        turn.doTurn();

        System.out.println(world);

        assertEquals(1, world.getPlayerLands(dal).size());
        assertEquals(true, playerLand.getWarriors().isEmpty());

        turn.doTurn();

        System.out.println(world);

        assertNotNull(toLand.getPlayer());
        assertEquals(2, world.getPlayerLands(dal).size());
        assertEquals(1, toLand.getWarriors().size());
        Warrior warrior = toLand.getWarriors().get(0);
        assertEquals(20, warrior.getCount());
        assertEquals(WarriorType.FIGHTER, warrior.getType());
    }

    @Test
    public void testCastleIncomeAtEndOfTurn() {
        Player dal = new Player(3, "Dal");
        dal.setId(42L);
        World world = new WorldFactory(dal).create(4, 4);
        world.ensurePlayerWorldResources(42L);
        Land land = world.getPlayerLands(dal).get(0);
        Turn turn = world.getTurn();
        turn.setCurrentPlayerId(42L);
        // столица уже с замком из WorldFactory
        int expectedIncome = land.getCosts();
        turn.doTurn();
        assertEquals(expectedIncome, world.findPlayerWorldResources(42L).orElseThrow().getGold());
    }
}
