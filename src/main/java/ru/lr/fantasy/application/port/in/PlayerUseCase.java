package ru.lr.fantasy.application.port.in;

import ru.lr.fantasy.domain.model.Player;

import java.util.List;

public interface PlayerUseCase {
    Player createPlayer(String name, int level);

    List<Player> getAllPlayers();

    Player getPlayer(Long id);
}
