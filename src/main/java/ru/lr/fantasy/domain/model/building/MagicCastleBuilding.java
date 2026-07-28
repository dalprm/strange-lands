package ru.lr.fantasy.domain.model.building;

import ru.lr.fantasy.domain.model.visitors.IBuildingVisitor;

public class MagicCastleBuilding extends Building {
    public MagicCastleBuilding() {
        super("Magic castle");
    }

    @Override
    public void acceptBuildingVisitor(IBuildingVisitor visitor) {
        visitor.visit(this);
    }
}
