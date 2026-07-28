package ru.lr.fantasy.domain.model.action;

import ru.lr.fantasy.domain.model.World;

/**
 * Начисление золота с земель текущего игрока, где построен замок; ставится в конец очереди в {@link ru.lr.fantasy.domain.model.Turn#doTurn()}.
 */
public class CollectCastleIncomeAction implements IGameAction {

    private final World world;
    private final Long playerId;

    public CollectCastleIncomeAction(World world, Long playerId) {
        this.world = world;
        this.playerId = playerId;
    }

    @Override
    public boolean action() {
        if (world == null || playerId == null) {
            return true;
        }
        world.collectCastleIncomeGoldForPlayer(playerId);
        return true;
    }

    @Override
    public boolean hot() {
        return false;
    }
}
