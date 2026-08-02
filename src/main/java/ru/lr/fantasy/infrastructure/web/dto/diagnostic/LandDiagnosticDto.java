package ru.lr.fantasy.infrastructure.web.dto.diagnostic;

import ru.lr.fantasy.domain.model.Land;
import ru.lr.fantasy.domain.model.Player;
import ru.lr.fantasy.domain.model.Warrior;
import ru.lr.fantasy.domain.model.building.Buildings;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

public record LandDiagnosticDto(
        Long id,
        String name,
        int costs,
        Player player,
        Buildings buildings,
        List<Warrior> warriors,
        List<String> accessBuildWarriorTypes,
        List<Long> neighboringLandIds,
        boolean claimPending
) {
    public static LandDiagnosticDto from(Land land) {
        List<Long> neighIds = land.getNeighboring().stream()
                .map(Land::getId)
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.toList());
        List<String> types = land.getAccessBuildWarriorTypes().stream()
                .map(Enum::name)
                .collect(Collectors.toList());
        return new LandDiagnosticDto(
                land.getId(),
                land.getName(),
                land.getCosts(),
                land.getPlayer(),
                land.getBuildings(),
                new ArrayList<>(land.getWarriors()),
                types,
                neighIds,
                land.isClaimPending()
        );
    }
}
