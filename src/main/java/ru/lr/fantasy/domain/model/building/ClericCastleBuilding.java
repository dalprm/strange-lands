package ru.lr.fantasy.domain.model.building;

import ru.lr.fantasy.domain.model.visitors.IBuildingVisitor;

public class ClericCastleBuilding extends Building {
    public ClericCastleBuilding() {
        super("Cleric castle");
    }

    @Override
    public void acceptBuildingVisitor(IBuildingVisitor visitor) {
        visitor.visit(this);
    }
}
