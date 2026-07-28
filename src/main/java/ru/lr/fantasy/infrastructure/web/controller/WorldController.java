package ru.lr.fantasy.infrastructure.web.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.lr.fantasy.application.port.in.WorldUseCase;
import ru.lr.fantasy.domain.model.World;
import ru.lr.fantasy.infrastructure.web.dto.diagnostic.WorldDiagnosticDto;
import ru.lr.fantasy.infrastructure.web.dto.diagnostic.WorldDiagnosticMapper;
import ru.lr.fantasy.infrastructure.web.dto.request.AddPlayerToWorldRequest;
import ru.lr.fantasy.infrastructure.web.dto.request.CreateWorldRequest;

import java.util.List;

@RestController
@RequestMapping("/api/worlds")
public class WorldController {

    private final WorldUseCase worldUseCase;

    public WorldController(WorldUseCase worldUseCase) {
        this.worldUseCase = worldUseCase;
    }

    @GetMapping
    public ResponseEntity<List<World>> getAllWorlds() {
        return ResponseEntity.ok(worldUseCase.getAllWorlds());
    }

    @GetMapping("/{id}")
    public ResponseEntity<World> getWorld(@PathVariable Long id) {
        return ResponseEntity.ok(worldUseCase.getWorld(id));
    }

    /**
     * Полный снимок мира в JSON: земли с явным списком id соседей, очередь отложенных действий хода, карта {@code neighbors}.
     */
    @GetMapping("/{id}/diagnostic")
    public ResponseEntity<WorldDiagnosticDto> getWorldDiagnostic(@PathVariable Long id) {
        World world = worldUseCase.getWorld(id);
        return ResponseEntity.ok(WorldDiagnosticMapper.toDto(world));
    }

    @PostMapping
    public ResponseEntity<World> createWorld(@Valid @RequestBody CreateWorldRequest request) {
        World world = worldUseCase.createWorld(request.getSizeX(), request.getSizeY(), request.getPlayerIds());
        return ResponseEntity.ok(world);
    }

    @PostMapping("/{worldId}/players")
    public ResponseEntity<Void> addPlayerToWorld(
            @PathVariable Long worldId,
            @Valid @RequestBody AddPlayerToWorldRequest request) {
        worldUseCase.addPlayerToWorld(worldId, request.getPlayerId());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteWorld(@PathVariable Long id) {
        worldUseCase.deleteWorld(id);
        return ResponseEntity.noContent().build();
    }
}
