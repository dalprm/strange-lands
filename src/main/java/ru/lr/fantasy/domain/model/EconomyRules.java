package ru.lr.fantasy.domain.model;

import ru.lr.fantasy.domain.model.building.BarrackBuilding;
import ru.lr.fantasy.domain.model.building.Building;
import ru.lr.fantasy.domain.model.building.CastleBuilding;
import ru.lr.fantasy.domain.model.building.ClericCastleBuilding;
import ru.lr.fantasy.domain.model.building.MagicCastleBuilding;
import ru.lr.fantasy.domain.model.building.WallBuilding;
import ru.lr.fantasy.domain.model.building.WallLevel;

/** Цены зданий и найма (GP). Списание — при заказе. */
public final class EconomyRules {

    public static final long STARTING_GOLD = 30_000L;

    public static final long COST_CASTLE = 7_500L;
    public static final long COST_BARRACK = 15_000L;
    public static final long COST_MAGIC_CASTLE = 10_000L;
    public static final long COST_CLERIC_CASTLE = 12_000L;

    private EconomyRules() {}

    public static long goldCostForWall(WallLevel level) {
        if (level == null) {
            throw new IllegalStateException("Уровень стены не задан");
        }
        return switch (level) {
            case FORTRESS_LEVEL_1 -> 5_000L;
            case FORTRESS_LEVEL_2 -> 10_000L;
            case FORTRESS_LEVEL_3 -> 15_000L;
            case FORTRESS_LEVEL_4 -> 20_000L;
        };
    }

    public static long goldCostForBuilding(Building building) {
        if (building instanceof CastleBuilding) {
            return COST_CASTLE;
        }
        if (building instanceof BarrackBuilding) {
            return COST_BARRACK;
        }
        if (building instanceof MagicCastleBuilding) {
            return COST_MAGIC_CASTLE;
        }
        if (building instanceof ClericCastleBuilding) {
            return COST_CLERIC_CASTLE;
        }
        if (building instanceof WallBuilding wall) {
            return goldCostForWall(wall.getWallLevel());
        }
        throw new IllegalStateException("Неизвестный тип здания: " + building.getClass().getSimpleName());
    }

    /** Цена одного заказного кванта: пачка 40 обычных или 1 осада/герой. */
    public static long goldCostPerRecruitQuantum(WarriorType type) {
        return switch (type) {
            case HOBBIT -> 400L;
            case FIGHTER -> 500L;
            case DWARF -> 600L;
            case ORC -> 700L;
            case SHADOW_ELF -> 1_500L;
            case ELF -> 2_000L;
            case TARAN, BALLISTA -> 1_500L;
            case CATAPULT -> 2_000L;
            case HERO_FIGHTER -> 2_000L;
            case HERO_DWARF -> 2_500L;
            case HERO_ELF -> 3_000L;
            case CLERIC, MAGIC -> 4_000L;
        };
    }

    public static long goldCostForRecruit(WarriorType type, int count) {
        if (count <= 0) {
            throw new IllegalStateException("Количество найма должно быть > 0");
        }
        if (RecruitRules.isOrdinary(type)) {
            if (count % 40 != 0) {
                throw new IllegalStateException("Обычные войска нанимаются кратно 40");
            }
            return (count / 40L) * goldCostPerRecruitQuantum(type);
        }
        return count * goldCostPerRecruitQuantum(type);
    }

    public static void spendGold(World world, Long playerId, long amount) {
        if (amount < 0) {
            throw new IllegalStateException("Сумма списания не может быть отрицательной");
        }
        if (amount == 0) {
            return;
        }
        if (playerId == null) {
            throw new IllegalStateException("Нет игрока для списания золота");
        }
        world.ensurePlayerWorldResources(playerId);
        PlayerWorldResources res = world.getPlayerWorldResources().get(playerId);
        if (res == null) {
            throw new IllegalStateException("Нет казны игрока");
        }
        res.spendGold(amount);
    }
}
