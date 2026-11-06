package fr.ressenti.model;

/**
 * Document Firestore responses/{uid}_{date} : une réponse par athlète et par séance.
 * Le nom et le poste sont copiés au moment de l'envoi pour garder l'historique lisible.
 */
public record SessionResponse(
        String id,
        String uid,
        String name,
        String poste,
        String date,
        int mus, int car, int rep,
        int conc, int pla, int conf,
        int tec, int tac, int opp,
        boolean blessure,
        String gene,
        String updatedAt) {

    public static String idOf(String uid, String date) {
        return uid + "_" + date;
    }
}
