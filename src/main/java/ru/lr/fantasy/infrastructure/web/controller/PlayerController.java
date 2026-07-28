package ru.lr.fantasy.infrastructure.web.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.lr.fantasy.application.port.in.PlayerUseCase;
import ru.lr.fantasy.domain.model.Player;

import java.util.List;

@RestController
@RequestMapping("/api/players")
public class PlayerController {

    private final PlayerUseCase playerUseCase;

    public PlayerController(PlayerUseCase playerUseCase) {
        this.playerUseCase = playerUseCase;
    }

    @GetMapping
    public ResponseEntity<List<Player>> getAll() {
        return ResponseEntity.ok(playerUseCase.getAllPlayers());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Player> getOne(@PathVariable Long id) {
        return ResponseEntity.ok(playerUseCase.getPlayer(id));
    }

    @PostMapping
    public ResponseEntity<Player> create(@RequestBody @Valid CreatePlayerRequest request) {
        int level = request.getLevel() != null ? request.getLevel() : 1;
        Player player = playerUseCase.createPlayer(request.getName(), level);
        return ResponseEntity.ok(player);
    }

    public static class CreatePlayerRequest {
        @NotBlank
        private String name;
        @Min(1)
        private Integer level;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public Integer getLevel() {
            return level;
        }

        public void setLevel(Integer level) {
            this.level = level;
        }
    }
}
