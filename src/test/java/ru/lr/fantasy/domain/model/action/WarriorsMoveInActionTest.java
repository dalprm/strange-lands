package ru.lr.fantasy.domain.model.action;

import org.junit.Test;
import ru.lr.fantasy.domain.model.Land;
import ru.lr.fantasy.domain.model.Player;
import ru.lr.fantasy.domain.model.Warrior;
import ru.lr.fantasy.domain.model.WarriorType;
import ru.lr.fantasy.domain.model.World;
import ru.lr.fantasy.domain.model.WorldFactory;

import static org.junit.Assert.assertEquals;

public class WarriorsMoveInActionTest {

    @Test
    public void testMoveInEmptyLand() {
        Player dal = new Player(3, "Dal");
        World world = new WorldFactory(dal).create(4, 4);
        Land playerLand = world.getPlayerLands(dal).get(0);
        playerLand.addWarriors(new Warrior(WarriorType.FIGHTER, 120));
        new WarriorsMoveOutAction(world, playerLand, new Warrior(WarriorType.FIGHTER, 100)).action();
        Land toLand = playerLand.getNeighboring().get(0);
        new WarriorsMoveInAction(world, toLand, dal, 1, new Warrior(WarriorType.FIGHTER, 100)).action();

        assertEquals(true, toLand.hasPlayer());
        assertEquals(true, toLand.getWarriors().size() == 1);
        assertEquals(100, toLand.getWarriors().get(0).getCount());

        System.out.println(world);
    }

    @Test
    public void testMoveInFriendCastle() {
        Player dal = new Player(3, "Dal");
        World world = new WorldFactory(dal).create(4, 4);
        Land playerLand = world.getPlayerLands(dal).get(0);
        playerLand.addWarriors(new Warrior(WarriorType.FIGHTER, 120));
        new WarriorsMoveOutAction(world, playerLand, new Warrior(WarriorType.FIGHTER, 100)).action();
        Land toLand = playerLand.getNeighboring().get(0);
        new WarriorsMoveInAction(world, toLand, dal, 1, new Warrior(WarriorType.FIGHTER, 100)).action();
        new WarriorsMoveOutAction(world, toLand, new Warrior(WarriorType.FIGHTER, 90)).action();
        new WarriorsMoveInAction(world, playerLand, dal, 1, new Warrior(WarriorType.FIGHTER, 90)).action();

        assertEquals(2, world.getPlayerLands(dal).size());
        assertEquals(110, playerLand.getWarriors().get(0).getCount());
        assertEquals(10, toLand.getWarriors().get(0).getCount());

        System.out.println(world);
    }

    @Test
    public void testMoveInBattleAttackedWin() {
        Player dal = new Player(3, "Dal");
        Player dragon = new Player(3, "Dragon");

        World world = new WorldFactory().create(4, 4);

        Land landDal = world.getLands().get(0);
        Land landDragon = landDal.getNeighboring().get(0);

        new WarriorsMoveInAction(world, landDal, dal, 1, new Warrior(WarriorType.FIGHTER, 100)).action();
        new WarriorsMoveInAction(world, landDragon, dragon, 1, new Warrior(WarriorType.FIGHTER, 90)).action();

        System.out.println(world);

        new WarriorsMoveOutAction(world, landDal, new Warrior(WarriorType.FIGHTER, 100)).action();
        new WarriorsMoveInAction(world, landDragon, dal, 1, new Warrior(WarriorType.FIGHTER, 100)).action();

        System.out.println(world);

        assertEquals(2, world.getPlayerLands(dal).size());
        assertEquals(dal, world.getPlayerLands(dal).get(0).getPlayer());
        assertEquals(dal, world.getPlayerLands(dal).get(1).getPlayer());

        assertEquals(true, landDal.getWarriors().isEmpty());
        assertEquals(10, landDragon.getWarriors().get(0).getCount());
    }

    @Test
    public void testMoveInBattleAttackedLoss() {
        Player dal = new Player(3, "Dal");
        Player dragon = new Player(3, "Dragon");

        World world = new WorldFactory().create(4, 4);

        Land landDal = world.getLands().get(0);
        Land landDragon = landDal.getNeighboring().get(0);

        new WarriorsMoveInAction(world, landDal, dal, 1, new Warrior(WarriorType.FIGHTER, 90)).action();
        new WarriorsMoveInAction(world, landDragon, dragon, 1, new Warrior(WarriorType.FIGHTER, 100)).action();

        System.out.println(world);

        new WarriorsMoveOutAction(world, landDal, new Warrior(WarriorType.FIGHTER, 90)).action();
        new WarriorsMoveInAction(world, landDragon, dal, 1, new Warrior(WarriorType.FIGHTER, 90)).action();

        System.out.println(world);

        assertEquals(1, world.getPlayerLands(dal).size());
        assertEquals(1, world.getPlayerLands(dragon).size());
        assertEquals(dal, landDal.getPlayer());
        assertEquals(dragon, landDragon.getPlayer());

        assertEquals(true, landDal.getWarriors().isEmpty());
        assertEquals(10, landDragon.getWarriors().get(0).getCount());
    }
}
