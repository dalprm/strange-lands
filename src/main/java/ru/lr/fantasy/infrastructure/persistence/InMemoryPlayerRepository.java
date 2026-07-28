package ru.lr.fantasy.infrastructure.persistence;

import org.springframework.stereotype.Component;
import ru.lr.fantasy.domain.repository.PlayerRepository;
import ru.lr.fantasy.domain.model.Player;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class InMemoryPlayerRepository implements PlayerRepository {

    private final Map<Long, Player> players = new ConcurrentHashMap<>();
    private final AtomicLong idGenerator = new AtomicLong(1);

    @Override
    public Player save(Player player) {
        if (player.getId() == null) {
            player.setId(idGenerator.getAndIncrement());
        }
        players.put(player.getId(), player);
        return player;
    }

    @Override
    public Optional<Player> findById(Long id) {
        return Optional.ofNullable(players.get(id));
    }

    @Override
    public List<Player> findAll() {
        return new ArrayList<>(players.values());
    }
}
