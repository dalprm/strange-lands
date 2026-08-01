package ru.lr.fantasy.application.port.in;

import ru.lr.fantasy.domain.model.Land;
import ru.lr.fantasy.domain.model.Player;
import ru.lr.fantasy.domain.model.RecruitOptions;
import ru.lr.fantasy.domain.model.Warrior;
import ru.lr.fantasy.domain.model.WarriorType;
import ru.lr.fantasy.domain.model.building.Building;

import java.util.List;

public interface LandUseCase {
    Land getLand(Long worldId, Long landId);
    List<Land> getLands(Long worldId);
    List<Land> getNeighboringLands(Long worldId, Long landId);

    /** Земли ходящего игрока, соседние с целевой клеткой и с войсками (legacy: цель → источники). */
    List<Land> listMoveSourceLandsForCurrentTurn(Long worldId, Long toLandId);

    /** Соседи земли-источника (своя с войсками, ход текущего игрока) — куда можно переместить. */
    List<Land> listMoveTargetLandsForCurrentTurn(Long worldId, Long fromLandId);

    void buildBuilding(Long worldId, Long landId, Building building);
    void recruitWarriors(Long worldId, Long landId, WarriorType warriorType, int count, int turnCount);
    /** Атомарный batch-найм: items уже схлопнуты по типу (count суммарный). */
    void recruitWarriorsBatch(Long worldId, Long landId, List<RecruitBatchItem> items);
    RecruitOptions getRecruitOptions(Long worldId, Long landId);
    void moveWarriors(Long worldId, Long fromLandId, Long toLandId, Warrior[] warriors);
    void moveWarriors(Long worldId, Long fromLandId, Long toLandId, Player player, int turns, Warrior[] warriors);

    record RecruitBatchItem(WarriorType warriorType, int count) {}
}
