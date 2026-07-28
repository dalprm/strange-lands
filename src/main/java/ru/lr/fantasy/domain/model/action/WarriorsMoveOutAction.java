package ru.lr.fantasy.domain.model.action;

import ru.lr.fantasy.domain.model.Land;
import ru.lr.fantasy.domain.model.Warrior;
import ru.lr.fantasy.domain.model.World;

public class WarriorsMoveOutAction implements IGameAction {
    private final World world;
    private final Land fromLand;
    private final Warrior[] warriors;

    public WarriorsMoveOutAction(World world, Land fromLand, Warrior... warriors) {
        this.world = world;
        this.fromLand = fromLand;
        this.warriors = warriors;
    }

    @Override
    public boolean action() {
        world.warriorsMoveOut(fromLand, warriors);
        return true;
    }

    @Override
    public boolean hot() {
        return true;
    }
}
