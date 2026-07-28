package ru.lr.fantasy.application.port.in;

import ru.lr.fantasy.domain.model.Land;
import ru.lr.fantasy.domain.model.Player;
import ru.lr.fantasy.domain.model.World;

import java.util.List;

public interface WorldUseCase {
    World createWorld(int sizeX, int sizeY);

    World createWorld(int sizeX, int sizeY, java.util.List<Long> playerIds);

    void addPlayerToWorld(Long worldId, Long playerId);
    World getWorld(Long id);
    List<World> getAllWorlds();
    List<Land> getPlayerLands(Long worldId, Long playerId);
    World saveWorld(World world);
    void deleteWorld(Long id);
}
