package ru.lr.fantasy.infrastructure.web.dto.diagnostic;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Полный снимок мира для отладки и анализа (без циклических JSON-ссылок между {@link ru.lr.fantasy.domain.model.Land}).
 */
public record WorldDiagnosticDto(
        Instant generatedAt,
        Long worldId,
        int sizeWidth,
        int sizeHeight,
        TurnDiagnosticDto turn,
        List<LandDiagnosticDto> lands,
        Map<Long, List<Long>> neighbors
) {}
