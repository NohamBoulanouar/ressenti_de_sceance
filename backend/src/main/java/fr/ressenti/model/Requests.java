package fr.ressenti.model;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** Corps des requêtes reçues par l'API. */
public final class Requests {

    private static final String M = "doit être entre 1 et 100";

    private Requests() {
    }

    public record Profile(
            @NotBlank(message = "Le nom est obligatoire") @Size(max = 60) String name,
            @NotBlank(message = "Le poste est obligatoire") String poste) {
    }

    public record ChangeRole(@NotNull Role role) {
    }

    public record Session(
            @NotNull(message = "La date est obligatoire") LocalDate date,
            @NotNull(message = M) @Min(value = 1, message = M) @Max(value = 100, message = M) Integer mus,
            @NotNull(message = M) @Min(value = 1, message = M) @Max(value = 100, message = M) Integer car,
            @NotNull(message = M) @Min(value = 1, message = M) @Max(value = 100, message = M) Integer rep,
            @NotNull(message = M) @Min(value = 1, message = M) @Max(value = 100, message = M) Integer conc,
            @NotNull(message = M) @Min(value = 1, message = M) @Max(value = 100, message = M) Integer pla,
            @NotNull(message = M) @Min(value = 1, message = M) @Max(value = 100, message = M) Integer conf,
            @NotNull(message = M) @Min(value = 1, message = M) @Max(value = 100, message = M) Integer tec,
            @NotNull(message = M) @Min(value = 1, message = M) @Max(value = 100, message = M) Integer tac,
            @NotNull(message = M) @Min(value = 1, message = M) @Max(value = 100, message = M) Integer opp,
            @NotNull(message = "Réponds à la question blessure") Boolean blessure,
            @Size(max = 200) String gene) {
    }
}
