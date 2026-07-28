package ru.lr.fantasy.domain.model.visitors;

import ru.lr.fantasy.domain.model.building.*;

public class BuildingVisitorNewBuilding implements IBuildingVisitor {
    private final Buildings buildings;

    public BuildingVisitorNewBuilding(Buildings buildings) {
        this.buildings = buildings;
    }

    @Override
    public void visit(CastleBuilding building) {
        buildings.buildCastle();
    }

    @Override
    public void visit(BarrackBuilding building) {
        buildings.buildBarrack();
    }

    @Override
    public void visit(WallBuilding building) {
        buildings.buildWall(building.getWallLevel());
    }

    @Override
    public void visit(ClericCastleBuilding building) {
        buildings.buildClericCastle();
    }

    @Override
    public void visit(MagicCastleBuilding building) {
        buildings.buildMagicCastle();
    }
}
