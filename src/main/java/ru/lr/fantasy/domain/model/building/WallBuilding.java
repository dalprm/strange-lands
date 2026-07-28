package ru.lr.fantasy.domain.model.building;

import ru.lr.fantasy.domain.model.visitors.IBuildingVisitor;

public class WallBuilding extends Building {
    private WallLevel wallLevel;

    public WallBuilding(WallLevel wallLevel) {
        super("Wall");
        this.wallLevel = wallLevel;
    }

    public WallLevel getWallLevel() {
        return wallLevel;
    }

    @Override
    public void acceptBuildingVisitor(IBuildingVisitor visitor) {
        visitor.visit(this);
    }
}
