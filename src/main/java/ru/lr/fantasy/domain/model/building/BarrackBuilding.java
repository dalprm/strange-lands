package ru.lr.fantasy.domain.model.building;

import ru.lr.fantasy.domain.model.visitors.IBuildingVisitor;

public class BarrackBuilding extends Building {
    public BarrackBuilding() {
        super("Barrack");
    }

    @Override
    public void acceptBuildingVisitor(IBuildingVisitor visitor) {
        visitor.visit(this);
    }
}
