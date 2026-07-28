package ru.lr.fantasy.domain.model.building;

import ru.lr.fantasy.domain.model.visitors.IBuildingVisitor;

public class CastleBuilding extends Building {
    public CastleBuilding() {
        super("Castle");
    }

    @Override
    public void acceptBuildingVisitor(IBuildingVisitor visitor) {
        visitor.visit(this);
    }
}
