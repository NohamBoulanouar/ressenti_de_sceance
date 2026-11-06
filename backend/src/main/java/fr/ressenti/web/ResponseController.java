package fr.ressenti.web;

import fr.ressenti.model.Requests;
import fr.ressenti.model.SessionResponse;
import fr.ressenti.security.AuthUser;
import fr.ressenti.service.ResponseService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/responses")
public class ResponseController {

    private final ResponseService service;

    public ResponseController(ResponseService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseService.SaveResult submit(AuthUser auth, @Valid @RequestBody Requests.Session body) {
        return service.submit(auth, body);
    }

    @GetMapping("/me")
    public List<SessionResponse> mine(AuthUser auth, @RequestParam(defaultValue = "5") int limit) {
        return service.mine(auth, limit);
    }

    /** Vue coach : toutes les réponses de l'équipe, filtrables par période (dates AAAA-MM-JJ). */
    @GetMapping
    public List<SessionResponse> team(AuthUser auth,
                                      @RequestParam(required = false) String from,
                                      @RequestParam(required = false) String to) {
        return service.team(auth, from, to);
    }
}
