//
//  UIAlertController.swift
//  Webview Interaction Sample
//
//  Created by 劉紅営 on 2025/05/10.
//

import UIKit

extension UIViewController {
    func showToast(message: String, duration: Double = 2.0) {
        let alert = UIAlertController(
            title: nil,
            message: message,
            preferredStyle: .alert
        )
        self.present(alert, animated: true)

        DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
            alert.dismiss(animated: true)
        }
    }
}
