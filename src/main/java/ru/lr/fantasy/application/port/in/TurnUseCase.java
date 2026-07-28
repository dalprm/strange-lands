package ru.lr.fantasy.application.port.in;

import ru.lr.fantasy.domain.model.Turn;

public interface TurnUseCase {
    Turn getCurrentTurn(Long worldId);
    Turn executeTurn(Long worldId);
}
