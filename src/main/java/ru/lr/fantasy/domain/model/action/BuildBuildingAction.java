package ru.lr.fantasy.domain.model.action;

import ru.lr.fantasy.domain.model.Land;
import ru.lr.fantasy.domain.model.World;
import ru.lr.fantasy.domain.model.building.Building;

public class BuildBuildingAction implements IGameAction {
    private final World world;
    private final Land land;
    private final Building building;

    public BuildBuildingAction(World world, Land land, Building building) {
        this.world = world;
        this.land = land;
        this.building = building;
    }

    @Override
    public boolean action() {
        world.buildBuilding(land, building);
        return true;
    }

    @Override
    public boolean hot() {
        return true;
    }
}
