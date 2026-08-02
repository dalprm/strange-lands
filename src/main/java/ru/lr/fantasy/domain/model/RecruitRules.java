package ru.lr.fantasy.domain.model;

import ru.lr.fantasy.domain.model.building.Buildings;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/** Правила найма: длительность, слоты, доступность (ENH-002…004). */
public final class RecruitRules {

    public enum SlotPool {
        BARRACK,
        CLERIC,
        MAGIC
    }

    private static final Set<WarriorType> ORDINARY = EnumSet.of(
            WarriorType.FIGHTER,
            WarriorType.ORC,
            WarriorType.ELF,
            WarriorType.DWARF,
            WarriorType.SHADOW_ELF,
            WarriorType.HOBBIT);

    private static final Set<WarriorType> SIEGE = EnumSet.of(
            WarriorType.CATAPULT,
            WarriorType.BALLISTA,
            WarriorType.TARAN);

    private RecruitRules() {}

    public static boolean isOrdinary(WarriorType type) {
        return ORDINARY.contains(type);
    }

    public static boolean isSiege(WarriorType type) {
        return SIEGE.contains(type);
    }

    public static int turnCountFor(WarriorType type) {
        return switch (type) {
            case FIGHTER, DWARF, ORC, HOBBIT -> 1;
            case ELF, SHADOW_ELF -> 2;
            case TARAN, BALLISTA -> 3;
            case CATAPULT, HERO_FIGHTER, HERO_DWARF, HERO_ELF -> 4;
            case CLERIC, MAGIC -> 5;
        };
    }

    public static SlotPool poolFor(WarriorType type) {
        return switch (type) {
            case CLERIC -> SlotPool.CLERIC;
            case MAGIC -> SlotPool.MAGIC;
            default -> SlotPool.BARRACK;
        };
    }

    /** Сколько слотов пула занимает данный count. */
    public static int slotsRequired(WarriorType type, int count) {
        if (count <= 0) {
            throw new IllegalStateException("Количество найма должно быть > 0");
        }
        if (isOrdinary(type)) {
            if (count % 40 != 0) {
                throw new IllegalStateException("Обычные войска нанимаются кратно 40");
            }
            return count / 40;
        }
        // siege + heroes + cleric/magic: 1 unit = 1 slot
        return count;
    }

    /** Слотов найма на одну казарму (обычные / осада / герои казарменного пула). */
    public static final int SLOTS_PER_BARRACK = 3;

    public static int barrackSlotCapacity(Buildings buildings) {
        return buildings.getBarrackCount() * SLOTS_PER_BARRACK;
    }

    public static int clericSlotCapacity(Buildings buildings) {
        return buildings.getClericCastleCount();
    }

    public static int magicSlotCapacity(Buildings buildings) {
        return buildings.getMagicCastleCount();
    }

    public static int capacity(SlotPool pool, Buildings buildings) {
        return switch (pool) {
            case BARRACK -> barrackSlotCapacity(buildings);
            case CLERIC -> clericSlotCapacity(buildings);
            case MAGIC -> magicSlotCapacity(buildings);
        };
    }

    public static void assertEligible(Land land, WarriorType type) {
        Buildings buildings = land.getBuildings();
        List<WarriorType> access = land.getAccessBuildWarriorTypes();

        switch (type) {
            case HERO_FIGHTER -> {
                requireAccess(access, WarriorType.FIGHTER, type);
            }
            case HERO_DWARF -> {
                requireAccess(access, WarriorType.DWARF, type);
            }
            case HERO_ELF -> {
                if (!access.contains(WarriorType.ELF) && !access.contains(WarriorType.SHADOW_ELF)) {
                    throw new IllegalStateException("Герой-эльф: нужен ELF или SHADOW_ELF в доступе земли");
                }
            }
            case CLERIC -> {
                if (buildings.getClericCastleCount() <= 0) {
                    throw new IllegalStateException("Клирик: нужен замок клирика на земле");
                }
            }
            case MAGIC -> {
                if (buildings.getMagicCastleCount() <= 0) {
                    throw new IllegalStateException("Маг: нужен магический замок на земле");
                }
            }
            default -> {
                if (isOrdinary(type) || isSiege(type)) {
                    if (!access.contains(type)) {
                        throw new IllegalStateException("Тип " + type.name() + " недоступен на этой земле");
                    }
                } else {
                    throw new IllegalStateException("Неизвестный тип найма: " + type.name());
                }
            }
        }
    }

    private static void requireAccess(List<WarriorType> access, WarriorType needed, WarriorType hero) {
        if (!access.contains(needed)) {
            throw new IllegalStateException(hero.name() + ": нужен " + needed.name() + " в доступе земли");
        }
    }

    public static void assertCanRecruit(Land land, WarriorType type, int count, int pendingSlotsInPool) {
        assertEligible(land, type);
        SlotPool pool = poolFor(type);
        int need = slotsRequired(type, count);
        int cap = capacity(pool, land.getBuildings());
        int free = cap - pendingSlotsInPool;
        if (need > free) {
            throw new IllegalStateException(
                    "Недостаточно слотов найма (" + pool + "): нужно " + need + ", свободно " + Math.max(0, free));
        }
    }

    /** Типы, которые сейчас можно нанять на земле (без учёта свободных слотов > 0). */
    public static List<WarriorType> eligibleTypes(Land land) {
        List<WarriorType> out = new ArrayList<>();
        for (WarriorType type : WarriorType.values()) {
            try {
                assertEligible(land, type);
                out.add(type);
            } catch (IllegalStateException ignored) {
                // not eligible
            }
        }
        return out;
    }
}
