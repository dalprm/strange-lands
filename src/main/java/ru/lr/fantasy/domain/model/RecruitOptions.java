package ru.lr.fantasy.domain.model;

import java.util.List;

public record RecruitOptions(
        int barrackSlotsFree,
        int barrackSlotsCapacity,
        int clericSlotsFree,
        int clericSlotsCapacity,
        int magicSlotsFree,
        int magicSlotsCapacity,
        List<TypeOption> types,
        List<PendingSlot> pending
) {
    public record TypeOption(
            WarriorType warriorType,
            int turnCount,
            RecruitRules.SlotPool slotPool,
            int unitsPerSlot,
            int maxUnits,
            /** Цена одного кванта заказа (пачка 40 обычных / 1 прочий), GP. */
            long goldCost
    ) {}

    public record PendingSlot(
            WarriorType warriorType,
            int count,
            int turnsRemaining,
            RecruitRules.SlotPool slotPool
    ) {}
}
