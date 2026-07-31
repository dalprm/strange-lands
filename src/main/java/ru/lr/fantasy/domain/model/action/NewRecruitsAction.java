package ru.lr.fantasy.domain.model.action;

import ru.lr.fantasy.domain.model.Land;
import ru.lr.fantasy.domain.model.RecruitRules;
import ru.lr.fantasy.domain.model.WarriorType;
import ru.lr.fantasy.domain.model.World;

public class NewRecruitsAction implements IGameAction {
    private int turnCount;
    private WarriorType warrior;
    private World world;
    private Land land;
    private int warriorCount;

    public NewRecruitsAction(World world, Land land, WarriorType warrior, int warriorCount, int turnCount) {
        this.world = world;
        this.land = land;
        this.warrior = warrior;
        this.warriorCount = warriorCount;
        this.turnCount = turnCount;
    }

    public Land getLand() {
        return land;
    }

    public WarriorType getWarriorType() {
        return warrior;
    }

    public int getWarriorCount() {
        return warriorCount;
    }

    public int getTurnCountRemaining() {
        return turnCount;
    }

    /** Слоты пула, занятые этим pending-наймом. */
    public int slotsOccupied() {
        return RecruitRules.slotsRequired(warrior, warriorCount);
    }

    public RecruitRules.SlotPool slotPool() {
        return RecruitRules.poolFor(warrior);
    }

    @Override
    public boolean action() {
        boolean completeAction = turnCount == 1;
        if (completeAction) {
            world.newRecruits(land, warrior, warriorCount);
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
