package ru.lr.fantasy.application.service;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import ru.lr.fantasy.application.port.in.PlayerUseCase;
import ru.lr.fantasy.domain.repository.PlayerRepository;
import ru.lr.fantasy.domain.model.Player;

import java.util.List;

@org.springframework.stereotype.Service
public class PlayerService implements PlayerUseCase {

    private final PlayerRepository playerRepository;

    public PlayerService(PlayerRepository playerRepository) {
        this.playerRepository = playerRepository;
    }

    @Override
    public Player createPlayer(String name, int level) {
        Player player = new Player();
        player.setName(name);
        player.setLevel(level);
        return playerRepository.save(player);
    }

    @Override
    public List<Player> getAllPlayers() {
        return playerRepository.findAll();
    }

    @Override
    public Player getPlayer(Long id) {
        return playerRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Player not found: " + id));
    }
}
