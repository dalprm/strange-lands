package ru.lr.fantasy.infrastructure.web.dto.diagnostic;

import java.util.List;

public record RecruitOptionsDto(
        int barrackSlotsFree,
        int barrackSlotsCapacity,
        int clericSlotsFree,
        int clericSlotsCapacity,
        int magicSlotsFree,
        int magicSlotsCapacity,
        List<RecruitTypeOptionDto> types,
        List<PendingRecruitDto> pending
) {
    public record RecruitTypeOptionDto(
            String warriorType,
            int turnCount,
            String slotPool,
            int unitsPerSlot,
            int maxUnits
    ) {}

    public record PendingRecruitDto(
            String warriorType,
            int count,
            int turnsRemaining,
            String slotPool
    ) {}
}
