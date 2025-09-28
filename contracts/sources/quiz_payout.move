module sui_quiz::quiz_payout {
    use std::vector;
    use sui::coin::{Self as coin, Coin};
    use sui::sui::SUI;
    use sui::tx_context::{Self as tx_context, TxContext};
    use sui::transfer;

    /// `prize` içindeki SUI'yi `ratios` yüzdesine göre `winners` adreslerine yollar.
    /// `ratios` toplamı 100 olmalı. Son kişiye kalan bakiye (rounding farkı) verilir.
    public entry fun payout(
        winners: vector<address>,
        ratios: vector<u64>,
        mut prize: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let n = vector::length(&winners);
        assert!(n > 0, 0);
        assert!(n == vector::length(&ratios), 1);

        let mut sum: u64 = 0;
        let mut i = 0;
        while (i < n) {
            sum = sum + *vector::borrow(&ratios, i);
            i = i + 1;
        };
        assert!(sum == 100, 2);

        let total = coin::value(&prize);
        let mut distributed: u64 = 0;

        let mut j = 0;
        while (j < n) {
            let to = *vector::borrow(&winners, j);
            let amt =
                if (j == n - 1) {
                    total - distributed
                } else {
                    (total * *vector::borrow(&ratios, j)) / 100
                };
            distributed = distributed + amt;

            let piece = coin::split(&mut prize, amt, ctx);
            transfer::transfer(piece, to);

            j = j + 1;
        };

        coin::destroy_zero(prize);
    }
}