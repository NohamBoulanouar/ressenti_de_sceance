package fr.ressenti.repository;

import com.google.cloud.firestore.CollectionReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import fr.ressenti.model.SessionResponse;
import org.springframework.stereotype.Repository;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
public class ResponseRepository {

    private static final Comparator<SessionResponse> NEWEST_FIRST =
            Comparator.comparing(SessionResponse::date).thenComparing(SessionResponse::name,
                    Comparator.nullsLast(Comparator.naturalOrder())).reversed();

    private final CollectionReference responses;

    public ResponseRepository(Firestore db) {
        this.responses = db.collection("responses");
    }

    public boolean exists(String id) {
        return Futures.await(responses.document(id).get()).exists();
    }

    public void save(SessionResponse r) {
        Map<String, Object> data = new HashMap<>();
        data.put("uid", r.uid());
        data.put("name", r.name());
        data.put("poste", r.poste());
        data.put("date", r.date());
        data.put("mus", r.mus());
        data.put("car", r.car());
        data.put("rep", r.rep());
        data.put("conc", r.conc());
        data.put("pla", r.pla());
        data.put("conf", r.conf());
        data.put("tec", r.tec());
        data.put("tac", r.tac());
        data.put("opp", r.opp());
        data.put("blessure", r.blessure());
        data.put("gene", r.gene());
        data.put("updatedAt", r.updatedAt());
        Futures.await(responses.document(r.id()).set(data));
    }

    /** Réponses d'un athlète, la plus récente d'abord (tri en Java : pas d'index composite à créer). */
    public List<SessionResponse> findByUid(String uid) {
        return Futures.await(responses.whereEqualTo("uid", uid).get()).getDocuments().stream()
                .map(ResponseRepository::map).sorted(NEWEST_FIRST).toList();
    }

    /** Toutes les réponses entre deux dates incluses (null = pas de borne). */
    public List<SessionResponse> findBetween(String from, String to) {
        Query q = responses;
        if (from != null) q = q.whereGreaterThanOrEqualTo("date", from);
        if (to != null) q = q.whereLessThanOrEqualTo("date", to);
        return Futures.await(q.get()).getDocuments().stream()
                .map(ResponseRepository::map).sorted(NEWEST_FIRST).toList();
    }

    private static SessionResponse map(DocumentSnapshot d) {
        return new SessionResponse(d.getId(), d.getString("uid"), d.getString("name"), d.getString("poste"),
                d.getString("date"),
                i(d, "mus"), i(d, "car"), i(d, "rep"),
                i(d, "conc"), i(d, "pla"), i(d, "conf"),
                i(d, "tec"), i(d, "tac"), i(d, "opp"),
                Boolean.TRUE.equals(d.getBoolean("blessure")),
                d.getString("gene"),
                d.getString("updatedAt"));
    }

    private static int i(DocumentSnapshot d, String field) {
        Long v = d.getLong(field);
        return v == null ? 0 : v.intValue();
    }
}
