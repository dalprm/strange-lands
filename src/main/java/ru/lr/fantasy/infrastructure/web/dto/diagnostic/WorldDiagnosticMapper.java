package ru.lr.fantasy.infrastructure.web.dto.diagnostic;

import ru.lr.fantasy.domain.model.Turn;
import ru.lr.fantasy.domain.model.World;

import java.awt.*;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

public final class WorldDiagnosticMapper {

    private WorldDiagnosticMapper() {}

    public static WorldDiagnosticDto toDto(World world) {
        Dimension d = world.getSize();
        int w = d != null ? (int) d.getWidth() : 0;
        int h = d != null ? (int) d.getHeight() : 0;
        Turn t = world.getTurn();
        TurnDiagnosticDto turnDto = new TurnDiagnosticDto(
                t.getId(),
                t.getTurnNumber(),
                t.getCurrentPlayerId(),
                t.getPendingActionsCount(),
                t.describePendingActionsForDiagnostic()
        );
        List<LandDiagnosticDto> lands = world.getLands().stream()
                .map(LandDiagnosticDto::from)
                .collect(Collectors.toList());
        return new WorldDiagnosticDto(
                Instant.now(),
                world.getId(),
                w,
                h,
                turnDto,
                lands,
                world.getNeighbors()
        );
    }
}
