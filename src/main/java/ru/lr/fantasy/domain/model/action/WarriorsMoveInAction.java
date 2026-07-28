package ru.lr.fantasy.domain.model.action;

import ru.lr.fantasy.domain.model.Land;
import ru.lr.fantasy.domain.model.Player;
import ru.lr.fantasy.domain.model.Warrior;
import ru.lr.fantasy.domain.model.World;

public class WarriorsMoveInAction implements IGameAction {
    private final World world;
    private final Land toLand;
    private final Warrior[] warriors;
    private final Player player;
    private int turnCount;

    public WarriorsMoveInAction(World world, Land toLand, Player player, int turnCount, Warrior... warriors) {
        this.world = world;
        this.toLand = toLand;
        this.warriors = warriors;
        this.player = player;
        this.turnCount = turnCount;
    }

    @Override
    public boolean action() {
        boolean completeAction = turnCount == 1;
        if (completeAction) {
            world.warriorsMoveIn(toLand, player, warriors);
        } else {
            turnCount--;
        }
        return completeAction;
    }

    @Override
    public boolean hot() {
        return false;
    }
}
