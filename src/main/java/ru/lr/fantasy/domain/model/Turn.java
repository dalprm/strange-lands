package ru.lr.fantasy.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import ru.lr.fantasy.domain.model.action.CollectCastleIncomeAction;
import ru.lr.fantasy.domain.model.action.IGameAction;
import ru.lr.fantasy.domain.model.action.NewRecruitsAction;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.List;
import java.util.Objects;

public class Turn {
    private Long id;
    private int turnNumber;
    private World world;
    /** id игрока, чей сейчас ход. Задаётся при создании мира (первый из списка) или при первом подключении к пустому миру. */
    private Long currentPlayerId;
    @JsonIgnore
    private Deque<IGameAction> actionOfTurn = new ArrayDeque<>();

    public Turn() {}

    public Turn(World world) {
        this.world = world;
        this.turnNumber = 1;
        ensureCurrentPlayerAssigned();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public int getTurnNumber() {
        return turnNumber;
    }

    public void setTurnNumber(int turnNumber) {
        this.turnNumber = turnNumber;
    }

    public Long getCurrentPlayerId() {
        return currentPlayerId;
    }

    public void setCurrentPlayerId(Long currentPlayerId) {
        this.currentPlayerId = currentPlayerId;
    }

    /**
     * Диагностика REST: типы отложенных действий в порядке очереди.
     */
    public List<String> describePendingActionsForDiagnostic() {
        return actionOfTurn.stream().map(a -> a.getClass().getName()).toList();
    }

    @JsonIgnore
    public World getWorld() {
        return world;
    }

    public void setWorld(World world) {
        this.world = world;
    }

    /**
     * Если текущий игрок не задан — первый по id на карте; если текущий выбыл — снова первый из оставшихся.
     */
    public void ensureCurrentPlayerAssigned() {
        if (world == null) {
            return;
        }
        List<Long> onMap = playerIdsOnMapSorted();
        if (onMap.isEmpty()) {
            currentPlayerId = null;
            return;
        }
        if (currentPlayerId == null) {
            currentPlayerId = onMap.get(0);
            return;
        }
        if (!onMap.contains(currentPlayerId)) {
            currentPlayerId = onMap.get(0);
        }
    }

    public void acceptAction(IGameAction gameAction) {
        if (gameAction.hot()) {
            gameAction.action();
        } else {
            actionOfTurn.addLast(gameAction);
        }
    }

    public void doTurn() {
        Long finishingPlayerId = currentPlayerId;
        if (world != null && finishingPlayerId != null) {
            actionOfTurn.addLast(new CollectCastleIncomeAction(world, finishingPlayerId));
        }

        ArrayDeque<IGameAction> newActionOfTurn = new ArrayDeque<>();
        while (!actionOfTurn.isEmpty()) {
            IGameAction gameAction = actionOfTurn.pollFirst();
            if (!gameAction.action()) {
                newActionOfTurn.addLast(gameAction);
            }
        }
        actionOfTurn = newActionOfTurn;

        turnNumber++;
        advanceToNextPlayer();
    }

    private void advanceToNextPlayer() {
        if (world == null) {
            return;
        }
        List<Long> onMap = playerIdsOnMapSorted();
        if (onMap.isEmpty()) {
            currentPlayerId = null;
            return;
        }
        if (currentPlayerId == null) {
            currentPlayerId = onMap.get(0);
            return;
        }
        int idx = onMap.indexOf(currentPlayerId);
        if (idx < 0) {
            currentPlayerId = onMap.get(0);
            return;
        }
        currentPlayerId = onMap.get((idx + 1) % onMap.size());
    }

    /** Игроки с землёй, порядок смены хода — по возрастанию id. */
    private List<Long> playerIdsOnMapSorted() {
        if (world == null) {
            return List.of();
        }
        return world.getLands().stream()
                .filter(Land::hasPlayer)
                .map(l -> l.getPlayer().getId())
                .filter(Objects::nonNull)
                .distinct()
                .sorted(Comparator.naturalOrder())
                .toList();
    }

    @JsonProperty("pendingActionsCount")
    public int getPendingActionsCount() {
        return actionOfTurn.size();
    }

    /** Сумма слотов pending-наймов на земле в указанном пуле. */
    public int pendingRecruitSlots(Land land, RecruitRules.SlotPool pool) {
        int sum = 0;
        for (IGameAction action : actionOfTurn) {
            if (action instanceof NewRecruitsAction recruit
                    && recruit.getLand() != null
                    && land != null
                    && Objects.equals(recruit.getLand().getId(), land.getId())
                    && recruit.slotPool() == pool) {
                sum += recruit.slotsOccupied();
            }
        }
        return sum;
    }

    /** Отменить pending-наймы только для этой земли (смена владельца). */
    public void cancelPendingRecruitsForLand(Land land) {
        if (land == null || land.getId() == null) {
            return;
        }
        Long landId = land.getId();
        ArrayDeque<IGameAction> kept = new ArrayDeque<>();
        while (!actionOfTurn.isEmpty()) {
            IGameAction action = actionOfTurn.pollFirst();
            if (action instanceof NewRecruitsAction recruit
                    && recruit.getLand() != null
                    && landId.equals(recruit.getLand().getId())) {
                continue;
            }
            kept.addLast(action);
        }
        actionOfTurn = kept;
    }

    /** Pending-наймы земли: по одной записи на слот. */
    public List<PendingRecruitSlot> pendingRecruitSlotsDetail(Land land) {
        if (land == null || land.getId() == null) {
            return List.of();
        }
        Long landId = land.getId();
        List<PendingRecruitSlot> out = new ArrayList<>();
        for (IGameAction action : actionOfTurn) {
            if (!(action instanceof NewRecruitsAction recruit)
                    || recruit.getLand() == null
                    || !landId.equals(recruit.getLand().getId())) {
                continue;
            }
            int slots = recruit.slotsOccupied();
            int perSlot = RecruitRules.isOrdinary(recruit.getWarriorType()) ? 40 : 1;
            for (int i = 0; i < slots; i++) {
                out.add(new PendingRecruitSlot(
                        recruit.getWarriorType(),
                        perSlot,
                        recruit.getTurnCountRemaining(),
                        recruit.slotPool()));
            }
        }
        return out;
    }

    public record PendingRecruitSlot(
            WarriorType warriorType,
            int count,
            int turnsRemaining,
            RecruitRules.SlotPool slotPool
    ) {}
}
