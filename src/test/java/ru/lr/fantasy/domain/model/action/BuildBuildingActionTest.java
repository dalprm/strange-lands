package ru.lr.fantasy.domain.model.action;

import org.junit.Test;
import ru.lr.fantasy.domain.model.Land;
import ru.lr.fantasy.domain.model.Player;
import ru.lr.fantasy.domain.model.World;
import ru.lr.fantasy.domain.model.WorldFactory;
import ru.lr.fantasy.domain.model.building.BarrackBuilding;
import ru.lr.fantasy.domain.model.building.CastleBuilding;

import static org.junit.Assert.assertEquals;

public class BuildBuildingActionTest {

    @Test
    public void testBuildBuildingAddToNew() {
        Player dal = new Player(3, "Dal");
        World world = new WorldFactory().create(4, 4);
        Land playerLand = world.getLands().get(0);
        playerLand.setPlayer(dal);

        CastleBuilding castleBuilding = new CastleBuilding();
        new BuildBuildingAction(world, playerLand, castleBuilding).action();

        assertEquals(1, playerLand.getBuildings().getAll().size());
        assertEquals(castleBuilding.getName(), playerLand.getBuildings().getAll().get(0).getName());

        System.out.println(world);
    }

    @Test
    public void testBuildBuildingAddToExist() {
        Player dal = new Player(3, "Dal");
        World world = new WorldFactory().create(4, 4);
        Land land = world.getLands().get(0);
        land.setPlayer(dal);

        BarrackBuilding barrackBuilding = new BarrackBuilding();

        new BuildBuildingAction(world, land, barrackBuilding).action();
        new BuildBuildingAction(world, land, barrackBuilding).action();

        assertEquals(1, land.getBuildings().getAll().size());
        assertEquals(barrackBuilding.getName(), land.getBuildings().getAll().get(0).getName());
        assertEquals(2, land.getBuildings().getBarrackCount());

        System.out.println(world);
    }
}
