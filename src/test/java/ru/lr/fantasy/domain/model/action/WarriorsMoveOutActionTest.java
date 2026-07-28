package ru.lr.fantasy.domain.model.action;

import org.junit.Test;
import ru.lr.fantasy.domain.model.Land;
import ru.lr.fantasy.domain.model.Player;
import ru.lr.fantasy.domain.model.Warrior;
import ru.lr.fantasy.domain.model.WarriorType;
import ru.lr.fantasy.domain.model.World;
import ru.lr.fantasy.domain.model.WorldFactory;

import static org.junit.Assert.assertEquals;

public class WarriorsMoveOutActionTest {

    @Test
    public void testMoveOut() {
        Player dal = new Player(3, "Dal");

        World world = new WorldFactory(dal).create(4, 4);

        Land playerLand = world.getPlayerLands(dal).get(0);
        playerLand.addWarriors(new Warrior(WarriorType.FIGHTER, 120));

        new WarriorsMoveOutAction(world, playerLand, new Warrior(WarriorType.FIGHTER, 100)).action();

        assertEquals(20, playerLand.getWarriors().get(0).getCount());

        new WarriorsMoveOutAction(world, playerLand, new Warrior(WarriorType.FIGHTER, 20)).action();

        assertEquals(true, playerLand.getWarriors().isEmpty());
    }
}
