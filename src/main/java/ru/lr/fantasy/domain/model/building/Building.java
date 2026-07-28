package ru.lr.fantasy.domain.model.building;

import ru.lr.fantasy.domain.model.visitors.IBuildingVisitor;

public abstract class Building {
    private String name;

    protected Building(String name) {
        this.name = name;
    }

    public abstract void acceptBuildingVisitor(IBuildingVisitor visitor);

    public String getName() {
        return name;
    }
}
