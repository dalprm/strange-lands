package ru.lr.fantasy.application.service;

import ru.lr.fantasy.application.port.in.TurnUseCase;
import ru.lr.fantasy.domain.repository.WorldRepository;
import ru.lr.fantasy.domain.model.Turn;
import ru.lr.fantasy.domain.model.World;

@org.springframework.stereotype.Service
public class TurnService implements TurnUseCase {

    private final WorldRepository worldRepository;

    public TurnService(WorldRepository worldRepository) {
        this.worldRepository = worldRepository;
    }

    @Override
    public Turn getCurrentTurn(Long worldId) {
        World world = getWorld(worldId);
        Turn turn = world.getTurn();
        turn.ensureCurrentPlayerAssigned();
        return turn;
    }

    @Override
    public Turn executeTurn(Long worldId) {
        World world = getWorld(worldId);
        Turn turn = world.getTurn();
        turn.ensureCurrentPlayerAssigned();
        turn.doTurn();
        turn.ensureCurrentPlayerAssigned();
        worldRepository.save(world);
        return turn;
    }

    private World getWorld(Long worldId) {
        return worldRepository.findById(worldId)
                .orElseThrow(() -> new RuntimeException("World not found with id: " + worldId));
    }
}
