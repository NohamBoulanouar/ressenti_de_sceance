package fr.ressenti.repository;

import com.google.api.core.ApiFuture;

import java.util.concurrent.ExecutionException;

/** Les appels Firestore sont asynchrones : on attend simplement le résultat. */
final class Futures {

    private Futures() {
    }

    static <T> T await(ApiFuture<T> future) {
        try {
            return future.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Appel Firestore interrompu", e);
        } catch (ExecutionException e) {
            throw new IllegalStateException("Erreur Firestore : " + e.getCause().getMessage(), e.getCause());
        }
    }
}
