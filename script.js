// Remplacez les valeurs ci-dessous par les vôtres (trouvées sur Supabase)
const SUPABASE_URL = 'https://xiqgxkpymztunrkrwxkv.supabase.co'; // Copiez votre URL ici
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpcWd4a3B5bXp0dW5ya3J3eGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MDE3ODYsImV4cCI6MjA2ODE3Nzc4Nn0.CZhbS2B_31KQQWo73KBCrttoc8qEY3n_-a_LCjk5TJQ'; // Copiez votre clé ici

// Initialise le client Supabase DIRECTEMENT.
// Cette ligne doit s'exécuter seulement APRES que le script supabase-js ait fini de charger.
// L'ordre des balises script dans index.html est crucial pour cela.
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Si la ligne ci-dessus donne toujours 'undefined', cela signifie que window.supabase n'est pas prêt.
// Dans ce cas, nous devons utiliser window.supabase explicitement, car c'est là que la librairie l'attache.
// const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


document.addEventListener('DOMContentLoaded', () => {
    // Tout le reste de votre code JavaScript va ici, car le DOM est prêt.

    const formAjoutProduit = document.getElementById('form-ajout-produit');
    const corpsTableau = document.getElementById('corps-tableau');
    const SEUIL_STOCK_FAIBLE = 10;
    
    // Affiche l'inventaire au chargement
    afficherInventaire(); // Appeler cette fonction ici

    /**
     * Récupère les produits depuis la base de données Supabase et les affiche
     */
    async function afficherInventaire() {
        corpsTableau.innerHTML = '<tr><td colspan="5">Chargement...</td></tr>';

        const { data: produits, error } = await supabase
            .from('produits')
            .select('*')
            .order('categorie', { ascending: true });

        if (error) {
            console.error('Erreur lors de la récupération:', error);
            corpsTableau.innerHTML = `<tr><td colspan="5">Erreur de chargement des produits : ${error.message || 'Problème de connexion'}.</td></tr>`;
            return;
        }

        corpsTableau.innerHTML = '';
        if (produits.length === 0) {
            corpsTableau.innerHTML = '<tr><td colspan="5">Aucun produit dans l\'inventaire.</td></tr>';
            return;
        }

        produits.forEach(produit => {
            const tr = document.createElement('tr');
            let statutTexte = 'En Stock';
            let statutClasse = 'statut-ok';
            if (produit.stock <= 0) {
                statutTexte = 'EN RUPTURE';
                statutClasse = 'statut-rupture';
            } else if (produit.stock <= SEUIL_STOCK_FAIBLE) {
                statutTexte = 'Stock Faible';
                statutClasse = 'statut-faible';
            }
            
            tr.innerHTML = `
                <td>${produit.nom}</td>
                <td>${produit.categorie}</td>
                <td>${produit.stock}</td>
                <td class="${statutClasse}">${statutTexte}</td>
                <td>
                    <button class="btn-action btn-ajouter" data-id="${produit.id}" data-stock="${produit.stock}">+</button>
                    <button class="btn-action btn-retirer" data-id="${produit.id}" data-stock="${produit.stock}">-</button>
                    <button class="btn-action btn-supprimer" data-id="${produit.id}" data-nom="${produit.nom}">🗑️</button>
                </td>
            `;
            corpsTableau.appendChild(tr);
        });
    }

    formAjoutProduit.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const nom = document.getElementById('nom-produit').value.trim();
        const stock = parseInt(document.getElementById('stock-initial').value, 10);
        const categorie = document.getElementById('categorie-produit').value;

        if (categorie === "") {
            alert('Erreur : Veuillez sélectionner une catégorie.');
            return;
        }
        
        const { data: existingProducts, error: fetchError } = await supabase
            .from('produits')
            .select('nom')
            .eq('nom', nom);

        if (fetchError) {
            console.error('Erreur lors de la vérification du produit existant:', fetchError);
            alert('Une erreur est survenue lors de la vérification. Veuillez réessayer.');
            return;
        }

        if (existingProducts && existingProducts.length > 0) {
            alert('Erreur : Ce produit existe déjà dans l\'inventaire.');
            return;
        }

        const { error } = await supabase.from('produits').insert([{ nom, stock, categorie }]);
        
        if (error) {
            console.error('Erreur lors de l\'ajout:', error);
            alert('Une erreur est survenue lors de l\'ajout : ' + error.message);
        } else {
            formAjoutProduit.reset(); 
            afficherInventaire(); 
        }
    });
    
    corpsTableau.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (id === undefined) return;

        if (target.classList.contains('btn-supprimer')) {
            const nomProduit = target.dataset.nom;
            if (confirm(`Êtes-vous sûr de vouloir supprimer le produit "${nomProduit}" ?`)) {
                const { error } = await supabase.from('produits').delete().eq('id', id);
                if (error) {
                    console.error('Erreur lors de la suppression:', error);
                    alert('Une erreur est survenue lors de la suppression : ' + error.message);
                }
                afficherInventaire();
            }
            return;
        }

        const quantiteStr = prompt("Quelle quantité ?", "1");
        if (quantiteStr === null) return;

        const quantite = parseInt(quantiteStr, 10);
        if (isNaN(quantite) || quantite <= 0) {
            alert("Veuillez entrer un nombre valide.");
            return;
        }
        
        let stockActuel = parseInt(target.dataset.stock, 10);
        let nouveauStock;
        if (target.classList.contains('btn-ajouter')) {
            nouveauStock = stockActuel + quantite;
        } else if (target.classList.contains('btn-retirer')) {
            nouveauStock = stockActuel - quantite;
        }

        const { error } = await supabase.from('produits').update({ stock: nouveauStock }).eq('id', id);
        if (error) {
            console.error('Erreur lors de la mise à jour du stock:', error);
            alert('Une erreur est survenue lors de la mise à jour du stock : ' + error.message);
        }
        afficherInventaire();
    });
});