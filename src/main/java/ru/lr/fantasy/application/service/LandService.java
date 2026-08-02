package ru.lr.fantasy.application.service;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import ru.lr.fantasy.application.port.in.LandUseCase;
import ru.lr.fantasy.domain.repository.WorldRepository;
import ru.lr.fantasy.domain.model.action.BuildBuildingAction;
import ru.lr.fantasy.domain.model.action.NewRecruitsAction;
import ru.lr.fantasy.domain.model.action.WarriorsMoveInAction;
import ru.lr.fantasy.domain.model.action.WarriorsMoveOutAction;
import ru.lr.fantasy.domain.model.*;
import ru.lr.fantasy.application.port.in.LandUseCase.RecruitBatchItem;
import ru.lr.fantasy.domain.model.building.Building;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@org.springframework.stereotype.Service
public class LandService implements LandUseCase {

    private final WorldRepository worldRepository;

    public LandService(WorldRepository worldRepository) {
        this.worldRepository = worldRepository;
    }

    @Override
    public Land getLand(Long worldId, Long landId) {
        World world = getWorld(worldId);
        Land land = world.getLand(landId);
        if (land == null) {
            throw new RuntimeException("Land not found with id: " + landId);
        }
        return land;
    }

    @Override
    public List<Land> getLands(Long worldId) {
        World world = getWorld(worldId);
        return world.getLands();
    }

    @Override
    public List<Land> getNeighboringLands(Long worldId, Long landId) {
        Land land = getLand(worldId, landId);
        return land.getNeighboring();
    }

    @Override
    public List<Land> listMoveSourceLandsForCurrentTurn(Long worldId, Long toLandId) {
        World world = getWorld(worldId);
        Land toLand = world.getLand(toLandId);
        if (toLand == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Земля не найдена: " + toLandId);
        }
        Turn turn = world.getTurn();
        turn.ensureCurrentPlayerAssigned();
        Long currentId = turn.getCurrentPlayerId();
        if (currentId == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "В мире нет игроков с землями — ход не назначен");
        }
        return world.getLands().stream()
                .filter(Land::hasPlayer)
                .filter(l -> currentId.equals(l.getPlayer().getId()))
                .filter(l -> l.getNeighboring().contains(toLand))
                .filter(l -> l.getWarriors().stream().anyMatch(w -> w.getCount() > 0))
                .sorted()
                .toList();
    }

    @Override
    public List<Land> listMoveTargetLandsForCurrentTurn(Long worldId, Long fromLandId) {
        World world = getWorld(worldId);
        Land fromLand = world.getLand(fromLandId);
        if (fromLand == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Земля не найдена: " + fromLandId);
        }
        assertLandOwnerIsCurrentPlayer(world, fromLand);
        boolean hasTroops = fromLand.getWarriors().stream().anyMatch(w -> w.getCount() > 0);
        if (!hasTroops) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "На земле нет войск для перемещения");
        }
        return fromLand.getNeighboring().stream().sorted().toList();
    }

    @Override
    public void buildBuilding(Long worldId, Long landId, Building building) {
        World world = getWorld(worldId);
        Land land = world.getLand(landId);
        assertLandOwnerIsCurrentPlayer(world, land);
        try {
            world.getTurn().acceptAction(new BuildBuildingAction(world, land, building));
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
        worldRepository.save(world);
    }

    @Override
    public void recruitWarriors(Long worldId, Long landId, WarriorType warriorType, int count, int turnCount) {
        recruitWarriorsBatch(worldId, landId, List.of(new RecruitBatchItem(warriorType, count)));
    }

    @Override
    public void recruitWarriorsBatch(Long worldId, Long landId, List<RecruitBatchItem> items) {
        if (items == null || items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Пустой список найма");
        }
        World world = getWorld(worldId);
        Land land = world.getLand(landId);
        assertLandOwnerIsCurrentPlayer(world, land);
        Turn turn = world.getTurn();

        // схлопнуть дубликаты типов на всякий случай
        Map<WarriorType, Integer> collapsed = new LinkedHashMap<>();
        for (RecruitBatchItem item : items) {
            if (item == null || item.warriorType() == null || item.count() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректный элемент найма");
            }
            collapsed.merge(item.warriorType(), item.count(), Integer::sum);
        }

        Map<RecruitRules.SlotPool, Integer> extraPending = new EnumMap<>(RecruitRules.SlotPool.class);
        long totalGold;
        try {
            totalGold = 0L;
            for (var entry : collapsed.entrySet()) {
                WarriorType type = entry.getKey();
                int count = entry.getValue();
                RecruitRules.SlotPool pool = RecruitRules.poolFor(type);
                int pending = turn.pendingRecruitSlots(land, pool) + extraPending.getOrDefault(pool, 0);
                RecruitRules.assertCanRecruit(land, type, count, pending);
                extraPending.merge(pool, RecruitRules.slotsRequired(type, count), Integer::sum);
                totalGold += EconomyRules.goldCostForRecruit(type, count);
            }
            if (!land.hasPlayer()) {
                throw new IllegalStateException("Нельзя нанимать на земле без владельца");
            }
            EconomyRules.spendGold(world, land.getPlayer().getId(), totalGold);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }

        for (var entry : collapsed.entrySet()) {
            WarriorType type = entry.getKey();
            int count = entry.getValue();
            int tc = RecruitRules.turnCountFor(type);
            turn.acceptAction(new NewRecruitsAction(world, land, type, count, tc));
        }
        worldRepository.save(world);
    }

    @Override
    public RecruitOptions getRecruitOptions(Long worldId, Long landId) {
        World world = getWorld(worldId);
        Land land = world.getLand(landId);
        if (land == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Земля не найдена: " + landId);
        }
        Turn turn = world.getTurn();
        var buildings = land.getBuildings();
        int barrackCap = RecruitRules.barrackSlotCapacity(buildings);
        int clericCap = RecruitRules.clericSlotCapacity(buildings);
        int magicCap = RecruitRules.magicSlotCapacity(buildings);
        int barrackFree = barrackCap - turn.pendingRecruitSlots(land, RecruitRules.SlotPool.BARRACK);
        int clericFree = clericCap - turn.pendingRecruitSlots(land, RecruitRules.SlotPool.CLERIC);
        int magicFree = magicCap - turn.pendingRecruitSlots(land, RecruitRules.SlotPool.MAGIC);

        List<RecruitOptions.TypeOption> types = new ArrayList<>();
        for (WarriorType type : RecruitRules.eligibleTypes(land)) {
            RecruitRules.SlotPool pool = RecruitRules.poolFor(type);
            int free = switch (pool) {
                case BARRACK -> barrackFree;
                case CLERIC -> clericFree;
                case MAGIC -> magicFree;
            };
            int unitsPerSlot = RecruitRules.isOrdinary(type) ? 40 : 1;
            int maxUnits = Math.max(0, free) * unitsPerSlot;
            types.add(new RecruitOptions.TypeOption(
                    type,
                    RecruitRules.turnCountFor(type),
                    pool,
                    unitsPerSlot,
                    maxUnits,
                    EconomyRules.goldCostPerRecruitQuantum(type)));
        }
        List<RecruitOptions.PendingSlot> pending = turn.pendingRecruitSlotsDetail(land).stream()
                .map(p -> new RecruitOptions.PendingSlot(
                        p.warriorType(),
                        p.count(),
                        p.turnsRemaining(),
                        p.slotPool()))
                .toList();
        return new RecruitOptions(
                Math.max(0, barrackFree),
                barrackCap,
                Math.max(0, clericFree),
                clericCap,
                Math.max(0, magicFree),
                magicCap,
                types,
                pending);
    }

    @Override
    public void moveWarriors(Long worldId, Long fromLandId, Long toLandId, Warrior[] warriors) {
        moveWarriors(worldId, fromLandId, toLandId, null, 1, warriors);
    }

    @Override
    public void moveWarriors(Long worldId, Long fromLandId, Long toLandId, Player player, int turns, Warrior[] warriors) {
        World world = getWorld(worldId);
        Land fromLand = world.getLand(fromLandId);
        Land toLand = world.getLand(toLandId);
        assertLandOwnerIsCurrentPlayer(world, fromLand);
        Player owner = player != null ? player : fromLand.getPlayer();
        int t = Math.max(1, turns);
        Turn turn = world.getTurn();
        turn.acceptAction(new WarriorsMoveOutAction(world, fromLand, warriors));
        turn.acceptAction(new WarriorsMoveInAction(world, toLand, owner, t, warriors));
        worldRepository.save(world);
    }

    private void assertLandOwnerIsCurrentPlayer(World world, Land land) {
        if (!land.hasPlayer()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Клетка без владельца");
        }
        assertPlayerIsCurrent(world, land.getPlayer());
    }

    private void assertPlayerIsCurrent(World world, Player player) {
        if (player == null || player.getId() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Игрок не задан");
        }
        Turn turn = world.getTurn();
        turn.ensureCurrentPlayerAssigned();
        Long current = turn.getCurrentPlayerId();
        if (current == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "В мире нет игроков с землями — ход не назначен");
        }
        if (!current.equals(player.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Сейчас ход игрока id=" + current + ", действие от имени id=" + player.getId());
        }
    }

    private World getWorld(Long worldId) {
        return worldRepository.findById(worldId)
                .orElseThrow(() -> new RuntimeException("World not found with id: " + worldId));
    }
}
