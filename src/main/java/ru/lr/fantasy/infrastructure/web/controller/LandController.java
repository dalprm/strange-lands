package ru.lr.fantasy.infrastructure.web.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import ru.lr.fantasy.application.port.in.LandUseCase;
import ru.lr.fantasy.domain.model.Land;
import ru.lr.fantasy.domain.model.RecruitOptions;
import ru.lr.fantasy.domain.model.Warrior;
import ru.lr.fantasy.domain.model.WarriorType;
import ru.lr.fantasy.domain.model.building.*;
import ru.lr.fantasy.infrastructure.web.dto.diagnostic.RecruitOptionsDto;
import ru.lr.fantasy.infrastructure.web.dto.request.BuildBuildingRequest;
import ru.lr.fantasy.infrastructure.web.dto.request.MoveWarriorsRequest;
import ru.lr.fantasy.infrastructure.web.dto.request.RecruitBatchRequest;
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

    @GetMapping("/{landId}/move-targets")
    public ResponseEntity<List<Land>> listMoveTargetLandsForCurrentTurn(
            @PathVariable Long worldId,
            @PathVariable Long landId) {
        return ResponseEntity.ok(landUseCase.listMoveTargetLandsForCurrentTurn(worldId, landId));
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

    @GetMapping("/{landId}/recruit-options")
    public ResponseEntity<RecruitOptionsDto> getRecruitOptions(
            @PathVariable Long worldId,
            @PathVariable Long landId) {
        RecruitOptions options = landUseCase.getRecruitOptions(worldId, landId);
        List<RecruitOptionsDto.RecruitTypeOptionDto> types = options.types().stream()
                .map(t -> new RecruitOptionsDto.RecruitTypeOptionDto(
                        t.warriorType().name(),
                        t.turnCount(),
                        t.slotPool().name(),
                        t.unitsPerSlot(),
                        t.maxUnits()))
                .toList();
        List<RecruitOptionsDto.PendingRecruitDto> pending = options.pending().stream()
                .map(p -> new RecruitOptionsDto.PendingRecruitDto(
                        p.warriorType().name(),
                        p.count(),
                        p.turnsRemaining(),
                        p.slotPool().name()))
                .toList();
        return ResponseEntity.ok(new RecruitOptionsDto(
                options.barrackSlotsFree(),
                options.barrackSlotsCapacity(),
                options.clericSlotsFree(),
                options.clericSlotsCapacity(),
                options.magicSlotsFree(),
                options.magicSlotsCapacity(),
                types,
                pending));
    }

    @PostMapping("/{landId}/recruit")
    public ResponseEntity<Void> recruitWarriors(
            @PathVariable Long worldId,
            @PathVariable Long landId,
            @RequestBody RecruitRequest request) {
        
        WarriorType warriorType = WarriorType.valueOf(request.getWarriorType());
        // turnCount from client ignored — server uses RecruitRules
        landUseCase.recruitWarriors(worldId, landId, warriorType, request.getCount(), 0);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{landId}/recruit-batch")
    public ResponseEntity<Void> recruitWarriorsBatch(
            @PathVariable Long worldId,
            @PathVariable Long landId,
            @RequestBody RecruitBatchRequest request) {
        if (request == null || request.getItems() == null || request.getItems().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Пустой список найма");
        }
        List<LandUseCase.RecruitBatchItem> items = request.getItems().stream()
                .map(i -> {
                    if (i == null || i.getWarriorType() == null || i.getWarriorType().isBlank() || i.getCount() == null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректный элемент найма");
                    }
                    try {
                        return new LandUseCase.RecruitBatchItem(
                                WarriorType.valueOf(i.getWarriorType().trim()),
                                i.getCount());
                    } catch (IllegalArgumentException e) {
                        throw new ResponseStatusException(
                                HttpStatus.BAD_REQUEST, "Неизвестный тип войск: " + i.getWarriorType());
                    }
                })
                .toList();
        landUseCase.recruitWarriorsBatch(worldId, landId, items);
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
