package ru.lr.fantasy.application.port.in;

import ru.lr.fantasy.domain.model.Land;
import ru.lr.fantasy.domain.model.Player;
import ru.lr.fantasy.domain.model.Warrior;
import ru.lr.fantasy.domain.model.WarriorType;
import ru.lr.fantasy.domain.model.building.Building;

import java.util.List;

public interface LandUseCase {
    Land getLand(Long worldId, Long landId);
    List<Land> getLands(Long worldId);
    List<Land> getNeighboringLands(Long worldId, Long landId);

    /** Земли ходящего игрока, соседние с целевой клеткой и с войсками (для перемещения / захвата). */
    List<Land> listMoveSourceLandsForCurrentTurn(Long worldId, Long toLandId);

    void buildBuilding(Long worldId, Long landId, Building building);
    void recruitWarriors(Long worldId, Long landId, WarriorType warriorType, int count, int turnCount);
    void moveWarriors(Long worldId, Long fromLandId, Long toLandId, Warrior[] warriors);
    void moveWarriors(Long worldId, Long fromLandId, Long toLandId, Player player, int turns, Warrior[] warriors);
}
