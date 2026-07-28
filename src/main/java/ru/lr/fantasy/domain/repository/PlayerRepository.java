package ru.lr.fantasy.domain.repository;

import ru.lr.fantasy.domain.model.Player;

import java.util.List;
import java.util.Optional;

public interface PlayerRepository {
    Player save(Player player);

    Optional<Player> findById(Long id);

    List<Player> findAll();
}
