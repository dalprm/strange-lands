package ru.lr.fantasy.domain.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import ru.lr.fantasy.domain.model.building.Building;

import java.awt.*;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

public class World {
    private Long id;
    private List<Land> lands = new ArrayList<>();
    private Dimension size;
    private Turn turn;
    /** id игрока → ресурсы этого игрока в данном мире. */
    private Map<Long, PlayerWorldResources> playerWorldResources = new LinkedHashMap<>();

    public World() {}

    public World(List<Land> lands, Dimension size) {
        this.lands = lands != null ? lands : new ArrayList<>();
        this.size = size;
        this.turn = new Turn(this);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public List<Land> getLands() {
        return lands;
    }

    public void setLands(List<Land> lands) {
        this.lands = lands;
    }

    public Dimension getSize() {
        return size;
    }

    public void setSize(Dimension size) {
        this.size = size;
    }

    public Turn getTurn() {
        if (turn == null) {
            turn = new Turn(this);
        }
        return turn;
    }

    public void setTurn(Turn turn) {
        this.turn = turn;
        if (turn != null) {
            turn.setWorld(this);
        }
    }

    public Map<Long, PlayerWorldResources> getPlayerWorldResources() {
        if (playerWorldResources == null) {
            playerWorldResources = new LinkedHashMap<>();
        }
        return playerWorldResources;
    }

    public void setPlayerWorldResources(Map<Long, PlayerWorldResources> playerWorldResources) {
        this.playerWorldResources = playerWorldResources != null ? playerWorldResources : new LinkedHashMap<>();
    }

    /**
     * Гарантирует запись ресурсов для игрока в мире (старт — нули). Без id не добавляет.
     */
    public void ensurePlayerWorldResources(Long playerId) {
        if (playerId == null) {
            return;
        }
        getPlayerWorldResources().putIfAbsent(playerId, PlayerWorldResources.zero());
    }

    public Optional<PlayerWorldResources> findPlayerWorldResources(Long playerId) {
        if (playerId == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(getPlayerWorldResources().get(playerId));
    }

    /**
     * Для JSON: id земли → список id соседних земель. Только числа, без вложенных {@link Land} — нет циклов и тяжёлого графа.
     */
    @JsonProperty(value = "neighbors", access = JsonProperty.Access.READ_ONLY)
    public Map<Long, List<Long>> getNeighbors() {
        if (lands == null || lands.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<Long>> out = new LinkedHashMap<>();
        for (Land land : lands) {
            if (land.getId() == null) {
                continue;
            }
            List<Long> neighborIds = land.getNeighboring().stream()
                    .map(Land::getId)
                    .filter(Objects::nonNull)
                    .sorted()
                    .collect(Collectors.toList());
            out.put(land.getId(), neighborIds);
        }
        return out;
    }

    public void warriorsMoveIn(Land toLand, Player player, Warrior... warriors) {
        if (toLand.hasPlayer() && toLand.getPlayer().equals(player)) {
            toLand.addWarriors(warriors);
        } else if (toLand.hasPlayer() && !toLand.getPlayer().equals(player)) {
            battle(toLand, player, warriors);
        } else {
            toLand.setPlayer(player);
            toLand.addWarriors(warriors);
        }
    }

    public void warriorsMoveOut(Land fromLand, Warrior... warriors) {
        fromLand.removeWarriors(warriors);
    }

    public void buildBuilding(Land land, Building building) {
        land.addBuilding(building);
    }

    public void battle(Land defenceLand, Player attackedPlayer, Warrior... attackedWarriors) {
        List<Warrior> defenceWarriors = defenceLand.getWarriors();

        for (Warrior defenceWarrior : defenceWarriors) {
            for (Warrior attackedWarrior : attackedWarriors) {
                int killed = Math.min(defenceWarrior.getCount(), attackedWarrior.getCount());
                defenceWarrior.removeCount(killed);
                attackedWarrior.removeCount(killed);
            }
        }

        int attCount = 0;
        for (Warrior attackedWarrior : attackedWarriors) {
            attCount += attackedWarrior.getCount();
        }

        if (attCount > 0) {
            defenceLand.setPlayer(attackedPlayer);
            warriorsMoveIn(defenceLand, attackedPlayer, attackedWarriors);
        }
    }

    public void newRecruits(Land land, WarriorType warriorType, int count) {
        land.newRecruits(warriorType, count);
    }

    public Land getLand(Long id) {
        for (Land land : lands) {
            if (land.getId().equals(id)) {
                return land;
            }
        }
        return null;
    }

    public List<Land> getPlayerLands(Player player) {
        return getLands().stream()
                .filter(x -> x.hasPlayer() && x.getPlayer().equals(player))
                .collect(Collectors.toList());
    }

    /**
     * Доход конца хода: все земли игрока с замком приносят {@link Land#getCosts()} золота в {@link PlayerWorldResources}.
     */
    public CastleIncomeSummary collectCastleIncomeGoldForPlayer(Long playerId) {
        if (playerId == null) {
            return new CastleIncomeSummary(0, 0);
        }
        ensurePlayerWorldResources(playerId);
        long total = 0;
        int castleLands = 0;
        for (Land land : getLands()) {
            if (!land.hasPlayer() || land.getPlayer().getId() == null
                    || !playerId.equals(land.getPlayer().getId())) {
                continue;
            }
            if (!land.getBuildings().hasCastle()) {
                continue;
            }
            total += land.getCosts();
            castleLands++;
        }
        PlayerWorldResources res = getPlayerWorldResources().get(playerId);
        if (res != null && total > 0) {
            res.setGold(res.getGold() + total);
        }
        return new CastleIncomeSummary(total, castleLands);
    }

    /** Итог начисления золота с замков за завершённый ход. */
    public static final class CastleIncomeSummary {
        private final long goldAdded;
        private final int castleLandCount;

        public CastleIncomeSummary(long goldAdded, int castleLandCount) {
            this.goldAdded = goldAdded;
            this.castleLandCount = castleLandCount;
        }

        public long getGoldAdded() {
            return goldAdded;
        }

        public int getCastleLandCount() {
            return castleLandCount;
        }
    }
}
