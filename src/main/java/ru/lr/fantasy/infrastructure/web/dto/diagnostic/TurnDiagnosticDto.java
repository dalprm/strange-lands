package ru.lr.fantasy.infrastructure.web.dto.diagnostic;

import java.util.List;

public record TurnDiagnosticDto(
        Long id,
        int turnNumber,
        Long currentPlayerId,
        int pendingActionsCount,
        List<String> pendingActions
) {}
