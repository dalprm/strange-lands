package ru.lr.fantasy.infrastructure.web.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.lr.fantasy.application.port.in.LandUseCase;
import ru.lr.fantasy.domain.model.Land;
import ru.lr.fantasy.domain.model.Warrior;
import ru.lr.fantasy.domain.model.WarriorType;
import ru.lr.fantasy.domain.model.building.*;
import ru.lr.fantasy.infrastructure.web.dto.request.BuildBuildingRequest;
import ru.lr.fantasy.infrastructure.web.dto.request.MoveWarriorsRequest;
import ru.lr.fantasy.infrastructure.web.dto.request.RecruitRequest;

import java.util.List;

@RestController
@RequestMapping("/api/worlds/{worldId}/lands")
public class LandController {

    private final LandUseCase landUseCase;

    public LandController(LandUseCase landUseCase) {
        this.landUseCase = landUseCase;
    }

    @GetMapping
    public ResponseEntity<List<Land>> getLands(@PathVariable Long worldId) {
        return ResponseEntity.ok(landUseCase.getLands(worldId));
    }

    @GetMapping("/{landId}/move-sources")
    public ResponseEntity<List<Land>> listMoveSourceLandsForCurrentTurn(
            @PathVariable Long worldId,
            @PathVariable Long landId) {
        return ResponseEntity.ok(landUseCase.listMoveSourceLandsForCurrentTurn(worldId, landId));
    }

    @GetMapping("/{landId}")
    public ResponseEntity<Land> getLand(@PathVariable Long worldId, @PathVariable Long landId) {
        return ResponseEntity.ok(landUseCase.getLand(worldId, landId));
    }

    @GetMapping("/{landId}/neighbors")
    public ResponseEntity<List<Land>> getNeighboringLands(@PathVariable Long worldId, @PathVariable Long landId) {
        return ResponseEntity.ok(landUseCase.getNeighboringLands(worldId, landId));
    }

    @PostMapping("/{landId}/build")
    public ResponseEntity<Void> buildBuilding(
            @PathVariable Long worldId,
            @PathVariable Long landId,
            @RequestBody BuildBuildingRequest request) {
        
        Building building = createBuilding(request);
        landUseCase.buildBuilding(worldId, landId, building);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{landId}/recruit")
    public ResponseEntity<Void> recruitWarriors(
            @PathVariable Long worldId,
            @PathVariable Long landId,
            @RequestBody RecruitRequest request) {
        
        WarriorType warriorType = WarriorType.valueOf(request.getWarriorType());
        int turnCount = request.getTurnCount() != null ? request.getTurnCount() : 1;
        landUseCase.recruitWarriors(worldId, landId, warriorType, request.getCount(), turnCount);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{fromLandId}/move")
    public ResponseEntity<Void> moveWarriors(
            @PathVariable Long worldId,
            @PathVariable Long fromLandId,
            @RequestBody MoveWarriorsRequest request) {
        
        Warrior[] warriors = request.getWarriors().stream()
                .map(w -> new Warrior(WarriorType.valueOf(w.getType()), w.getCount(), w.getLevel() != null ? w.getLevel() : 0))
                .toArray(Warrior[]::new);

        int turns = request.getTurns() != null ? request.getTurns() : 1;
        landUseCase.moveWarriors(worldId, fromLandId, request.getToLandId(), null, turns, warriors);
        return ResponseEntity.ok().build();
    }

    private Building createBuilding(BuildBuildingRequest request) {
        return switch (request.getBuildingType().toUpperCase()) {
            case "CASTLE" -> new CastleBuilding();
            case "BARRACK" -> new BarrackBuilding();
            case "WALL" -> new WallBuilding(WallLevel.values()[request.getWallLevel()]);
            case "MAGIC_CASTLE" -> new MagicCastleBuilding();
            case "CLERIC_CASTLE" -> new ClericCastleBuilding();
            default -> throw new IllegalArgumentException("Unknown building type: " + request.getBuildingType());
        };
    }
}
