package ru.lr.fantasy.infrastructure.web.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.lr.fantasy.application.port.in.TurnUseCase;
import ru.lr.fantasy.domain.model.Turn;

@RestController
@RequestMapping("/api/worlds/{worldId}/turns")
public class TurnController {

    private final TurnUseCase turnUseCase;

    public TurnController(TurnUseCase turnUseCase) {
        this.turnUseCase = turnUseCase;
    }

    @GetMapping("/current")
    public ResponseEntity<Turn> getCurrentTurn(@PathVariable Long worldId) {
        return ResponseEntity.ok(turnUseCase.getCurrentTurn(worldId));
    }

    @PostMapping("/execute")
    public ResponseEntity<Turn> executeTurn(@PathVariable Long worldId) {
        return ResponseEntity.ok(turnUseCase.executeTurn(worldId));
    }
}
